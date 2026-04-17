"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "./style.css";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebaseClient";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        window.alert("Signed in successfully!");
        router.push("/game");
      })
      .catch((err) => {
        setError(err.message);
        window.alert("Error signing in: " + err.message);
      });
  }

  return (
    <main className="auth-shell">
      <div className="auth-grid">
        <section className="auth-hero">
          <p className="pill">Welcome</p>
          <h1 className="hero-title">Sign in to start playing</h1>
          <p className="hero-subtitle">
            Sign in or create a new user to start playing Quinn and Mary's geography game! After registering, our website will provide you with many additional features.
          </p>
          <div className="hero-stats">
            <div className="stat-card">
              <p className="stat-label">Security</p>
              <p className="stat-value">2FA ready</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Sessions</p>
              <p className="stat-value">Fast sign-in</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Support</p>
              <p className="stat-value">Always on</p>
            </div>
          </div>
        </section>

        <section className="auth-card">
          <header className="card-header">
            <div>
              <p className="eyebrow">Sign in</p>
              <h2 className="card-title">Continue your journey</h2>
              <p className="card-subtitle">Use your email and password to enter.</p>
            </div>
          </header>

          <form className="auth-form" onSubmit={onSubmit}>
            <label className="input-label" htmlFor="username">
              Email
            </label>
            <input
              className="auth-input"
              id="username"
              type="email"
              placeholder="quinnstevens@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />

            <label className="input-label" htmlFor="password">
              Password
            </label>
            <input
              className="auth-input"
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            <button className="btn-primary" type="submit">
              Sign In
            </button>
          </form>

          <div className="card-footer">
            <Link href="/game" className="link-ghost">
              Jump into the game
            </Link>
            <Link href="/create-user" className="link-ghost">
              Create user
            </Link>
          </div>

          {error && <p className="error-text">{error}</p>}
        </section>
      </div>
    </main>
  );
}
