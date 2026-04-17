"use client";

import "./style.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../../lib/firebaseClient";

type Country = {
  name: { common: string };
  cca3?: string;
  region?: string;
  subregion?: string;
  capital?: string[];
  languages?: Record<string, string>;
  population?: number;
  latlng?: number[];
  area?: number;
  capitalInfo?: { latlng?: number[] };
  center?: LatLng;
  hitRadiusKm?: number;
};

type Round = {
  description: string;
  answer: Country;
};

type LatLng = { lat: number; lng: number };

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDescription(country: Country) {
  const capital = country.capital?.[0];
  const languages = country.languages ? Object.values(country.languages) : [];
  const population = country.population ? Math.round(country.population / 1_000_000) : undefined;
  const nameStart = country.name.common.charAt(0);
  const nameLetters = country.name.common.replace(/\s+/g, "").length;

  const parts = [];
  if (capital) parts.push(`Its capital city is ${capital}`);
  if (languages.length) {
    const langText =
      languages.length === 1
        ? languages[0]
        : `${languages.slice(0, -1).join(", ")} and ${languages[languages.length - 1]}`;
    parts.push(`Most people speak ${langText}`);
  }
  if (population) parts.push(`Home to about ${population} million people`);
  parts.push(`Its name starts with "${nameStart}" and has ${nameLetters} letters (ignoring spaces)`);

  return parts.join(". ") + ".";
}

const X_OFFSET = -1.5; // shift left to align with the map artwork
const Y_OFFSET = 1.2; // shift down slightly to better center markers vertically

function clamp01(v: number) {
  return Math.min(100, Math.max(0, v));
}

function latLngToPoint({ lat, lng }: LatLng) {
  const xRaw = ((lng + 180) / 360) * 100 + X_OFFSET;
  const yRaw = ((90 - lat) / 180) * 100 + Y_OFFSET;
  return { x: clamp01(xRaw), y: clamp01(yRaw) };
}

function pointToLatLng({ x, y }: { x: number; y: number }): LatLng {
  const lng = (((x - X_OFFSET) / 100) * 360) - 180;
  const lat = 90 - ((y - Y_OFFSET) / 100) * 180;
  return { lat, lng };
}

type GeoFeature = {
  properties: { ISO_A3: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any;
  };
};

function flattenCoords(geom: GeoFeature["geometry"]): [number, number][] {
  const coords: [number, number][] = [];
  if (geom.type === "Polygon") {
    geom.coordinates.forEach((ring: any) => ring.forEach((c: any) => coords.push([c[0], c[1]])));
  } else if (geom.type === "MultiPolygon") {
    geom.coordinates.forEach((poly: any) =>
      poly.forEach((ring: any) => ring.forEach((c: any) => coords.push([c[0], c[1]])))
    );
  }
  return coords;
}

function haversineKm(a: LatLng, b: LatLng) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return R * c;
  }


// Compute center point and max radius (in km) from center to any boundary point
// to help with hit detection
function computeCenterAndRadius(geom: GeoFeature["geometry"]): { center: LatLng; radiusKm: number } | null {
  const coords = flattenCoords(geom);
  if (!coords.length) return null;
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const center = { lat: (latMin + latMax) / 2, lng: (lngMin + lngMax) / 2 };
  let maxRadius = 0;
  coords.forEach(([lng, lat]) => {
    const dist = haversineKm(center, { lat, lng });
    if (dist > maxRadius) maxRadius = dist;
  });
  // add small buffer
  return { center, radiusKm: maxRadius * 1.1 };
}

export default function Game2Page() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [countries, setCountries] = useState<Country[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [round, setRound] = useState<Round | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [clickPoint, setClickPoint] = useState<LatLng | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastDistance, setLastDistance] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) router.replace("/");
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    async function loadCountries() {
      try {
        const res = await fetch(
          "https://restcountries.com/v3.1/all?fields=name,cca3,region,subregion,capital,languages,population,latlng,area,capitalInfo"
        );
        const data: Country[] = await res.json();
        const filtered = data.filter((c) => c.name?.common && c.cca3);

        // Load geo boundaries to derive better centroids and radii
        let enhanced: Country[] = filtered;
        try {
          const geoRes = await fetch(
            "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson"
          );
          const geoJson = await geoRes.json();
          const features: GeoFeature[] = geoJson.features || [];
          const geoMap = new Map<string, { center: LatLng; radiusKm: number }>();
          features.forEach((f) => {
            const iso = f.properties?.ISO_A3;
            if (!iso) return;
            const res = computeCenterAndRadius(f.geometry);
            if (res) {
              geoMap.set(iso, res);
            }
          });

          enhanced = filtered.map((c) => {
            const geo = c.cca3 ? geoMap.get(c.cca3) : undefined;
            return {
              ...c,
              center: geo?.center ?? (c.latlng ? { lat: c.latlng[0], lng: c.latlng[1] } : undefined),
              hitRadiusKm:
                geo?.radiusKm ??
                (c.area ? Math.max(200, Math.min(2000, Math.sqrt(c.area / Math.PI) * 1.4)) : undefined),
            };
          });
        } catch (geoErr) {
          console.error("GeoJSON load failed, falling back to restcountries centroids", geoErr);
          enhanced = filtered.map((c) => ({
            ...c,
            center: c.latlng ? { lat: c.latlng[0], lng: c.latlng[1] } : undefined,
          }));
        }

        setCountries(enhanced);
        setRound(generateRound(enhanced));
      } catch (err) {
        console.error("Failed to load countries", err);
      } finally {
        setDataLoading(false);
      }
    }
    loadCountries();
  }, []);

  const answeredCorrectly = round && selected === round.answer.name.common;

  function generateRound(list: Country[]): Round | null {
    if (!list.length) return null;
    const shuffled = shuffle(list);
    const correct = shuffled.find((c) => c.center) ?? shuffled[0];
    return {
      description: buildDescription(correct),
      answer: correct,
    };
  }

  /*
  function haversineKm(a: LatLng, b: LatLng) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return R * c;
  }*/

  function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!round) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const point = pointToLatLng({ x: xPct, y: yPct });
    setClickPoint(point);
    setShowFeedback(false);
    setSelected(null);
    setLastDistance(null);
    setHasSubmitted(false);
  }

  function submitGuess() {
    if (!round || !clickPoint || hasSubmitted) return;
    if (!user) return;
    const centerLatLng: LatLng = round.answer.center ?? {
      lat: round.answer.latlng?.[0] ?? round.answer.capitalInfo?.latlng?.[0] ?? 0,
      lng: round.answer.latlng?.[1] ?? round.answer.capitalInfo?.latlng?.[1] ?? 0,
    };
    const distance = haversineKm(clickPoint, centerLatLng);
    setLastDistance(distance);

    const areaKm2 = round.answer.area ?? 0;
    const inferredRadius = areaKm2 > 0 ? Math.sqrt(areaKm2 / Math.PI) : 0; // approximate circle radius
    const geoRadius = round.answer.hitRadiusKm ?? 0;
    // Scale radius so any point inside the country should be safe; always allow at least 1000 km
    const baseTolerance = geoRadius || (inferredRadius > 0 ? inferredRadius * 1.6 : 900);
    const clamped = Math.max(200, Math.min(2500, baseTolerance));
    const HIT_TOLERANCE_KM = Math.max(1000, clamped); // 1000 km floor, larger countries keep larger range
    const isCorrect = distance <= HIT_TOLERANCE_KM;
    setSelected(isCorrect ? round.answer.name.common : "miss");
    setShowFeedback(true);
    setHasSubmitted(true);
    if (isCorrect) setScore((s) => s + 1);
  }

  function nextQuestion() {
    if (!countries.length) return;
    setSelected(null);
    setShowFeedback(false);
    setClickPoint(null);
    setLastDistance(null);
    setHasSubmitted(false);
    setRound(generateRound(countries));
  }

  function resetGame() {
    setSelected(null);
    setShowFeedback(false);
    setScore(0);
    setClickPoint(null);
    setLastDistance(null);
    setHasSubmitted(false);
    setRound(generateRound(countries));
  }

  if (authLoading || dataLoading || !user || !round) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center shadow-lg">
          <p className="text-xs uppercase tracking-[0.25em] text-white/60">Loading</p>
          <p className="mt-2 font-semibold">Getting things ready...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-lg shadow-blue-900/30">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/50">Geography challenge</p>
            <h1 className="text-2xl font-semibold">Guess the country</h1>
            <p className="text-white/70 text-sm">Score: {score}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-full bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-400 transition"
              onClick={() => signOut(auth)}
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-blue-900/30 space-y-4">
          <p className="text-sm uppercase tracking-[0.25em] text-white/50">Description</p>
          <p className="text-lg leading-relaxed text-white/90">{round.description}</p>

          <div className="space-y-3">
            <p className="text-sm text-white/70">Click anywhere on the map where you think this country is.</p>
            <div className="game-map" onClick={handleMapClick} role="button" aria-label="World map">
              {clickPoint && (
                <div
                  className="map-marker marker-guess"
                  style={{
                    left: `${latLngToPoint(clickPoint).x}%`,
                    top: `${latLngToPoint(clickPoint).y}%`,
                  }}
                />
              )}
            <div className="map-grid" aria-hidden />
          </div>
          <div className="flex gap-3">
            <button
              className="rounded-full bg-gradient-to-r from-indigo-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 hover:from-indigo-400 hover:to-emerald-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
              type="button"
              onClick={submitGuess}
              disabled={!clickPoint || hasSubmitted}
            >
              Submit guess
            </button>
          </div>
        </div>

          {showFeedback && (
            <div
              className={`rounded-xl border px-4 py-3 shadow ${
                answeredCorrectly
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                  : "border-red-400/60 bg-red-500/15 text-red-100"
              }`}
            >
              {answeredCorrectly
                ? "Correct!"
                : `Not quite. The answer is ${round.answer.name.common}. ${
                    lastDistance ? `You were ~${Math.round(lastDistance)} km away.` : ""
                  }`}
            </div>
          )}

          {hasSubmitted && (
            <div className="flex justify-end pt-2">
              <button
                className="rounded-full bg-gradient-to-r from-indigo-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 hover:from-indigo-400 hover:to-emerald-500 transition"
                type="button"
                onClick={nextQuestion}
              >
                Next
              </button>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
