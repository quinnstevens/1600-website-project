# Geography Game

A web-based geography quiz where players read clues about a country and click on a world map to guess its location. Built with Next.js, TypeScript, and Firebase.

## Features

- Firebase Authentication — sign in or create an account to play
- Country clues generated from real data: capital city, language, population, and name hints
- Interactive world map — click to place your guess
- Scoring based on haversine distance from the actual country center
- Country boundary data from GeoJSON for accurate hit detection, with country-size-aware tolerance

## Tech Stack

- Next.js 15, TypeScript, Tailwind CSS
- Firebase Authentication
- [REST Countries API](https://restcountries.com) for country data
- [Natural Earth GeoJSON](https://github.com/datasets/geo-countries) for country boundaries

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

A Firebase project with Authentication enabled is required. Add your Firebase config to `src/lib/firebaseClient.ts`.
