<div align="center">

# Digital Cow

### A stylized 3D farm simulation built with React, Three.js, and a lightweight game-state engine.

<p>
  <img src="https://img.shields.io/badge/React-19-20232a?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Three.js-3D-black?style=for-the-badge&logo=three.js" alt="Three.js" />
  <img src="https://img.shields.io/badge/Vite-8-646cff?style=for-the-badge&logo=vite" alt="Vite 8" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Zustand-State%20Store-5a3e2b?style=for-the-badge" alt="Zustand" />
  <img src="https://img.shields.io/badge/Firebase-Hosting-ffca28?style=for-the-badge&logo=firebase" alt="Firebase Hosting" />
</p>

</div>

---

## Overview

Digital Cow is a low-poly interactive farm scene where a cow moves through a living daily loop driven by simulation state instead of fixed animation scripts. The project combines a real-time 3D scene, utility-style behavior selection, procedural audio, environmental effects, and a game-like overlay for direct interaction.

It is designed as a playable technical showcase:

- autonomous cow behaviors
- time-of-day and weather-driven atmosphere
- multiple camera modes
- player-triggered interaction loops
- simulation-first state architecture using Zustand vanilla store

---

## Why This Project Stands Out

<table>
  <tr>
    <td width="33%" valign="top">
      <h3>Simulation-First</h3>
      <p>The cow is driven by behavior state, needs, activities, and world conditions rather than a static animation timeline.</p>
    </td>
    <td width="33%" valign="top">
      <h3>Visually Layered</h3>
      <p>Dynamic sky, fog, weather, creatures, particles, post-processing, and environmental props create a rich low-poly scene.</p>
    </td>
    <td width="33%" valign="top">
      <h3>Playable Sandbox</h3>
      <p>Feed, pet, play, call, jump, drink, graze, milk, change breed, switch seasons, and inspect behavior in real time.</p>
    </td>
  </tr>
</table>

---

## Feature Snapshot

### Core Simulation

- Cow needs: hunger, energy, happiness, thirst
- Behavior states: idle, walking, grazing, eating, running, sleeping, settling, drinking, jumping
- Utility-based activity selection
- Time progression with speed controls and pause
- Day count and world-state tracking

### Interaction Layer

- Feed with hay, apple, or carrot
- Play, pet, call, jump, drink, graze, and milk actions
- Breed selection and age slider
- Season switching
- Butterfly and rain toggles

### Camera and Scene Systems

- Manual orbit camera
- Cinematic camera mode
- First-person mode
- Dynamic sky and fog
- Pond, barn, fences, trees, clouds, grass, decorations, and ambient creatures

### Diagnostics and Tooling

- Debug overlay with live behavior scores
- Optional profiler mode
- Renderer and performance inspection hooks
- Firebase Hosting configuration included

---

## Interaction Guide

| Area | What you can do |
| --- | --- |
| Bottom control panel | Feed, play, pet, call, jump, drink, graze, milk |
| Camera selector | Switch between manual, cinematic, and first-person views |
| Breed and age controls | Change visual breed profile and cow life stage |
| Season selector | Swap seasonal atmosphere |
| Time panel | Scrub time of day, change speed, pause or resume simulation |
| Debug overlay | Press `~` to inspect state, events, and behavior scoring |
| Cow mesh | Click the cow to pet it directly |

---

## Built With

| Tool | Role |
| --- | --- |
| React 19 | App shell and UI composition |
| Three.js | Rendering foundation |
| @react-three/fiber | React renderer for Three.js |
| @react-three/drei | Camera helpers, loaders, scene utilities |
| @react-three/postprocessing | Bloom and vignette polish |
| Zustand | Central simulation store |
| TypeScript | Type-safe engine and UI code |
| Vite | Fast development and production builds |
| Firebase Hosting | Static app deployment |

---

## Project Structure

```text
digitalcow/
|-- public/
|   `-- models/
|-- src/
|   |-- audio/         # procedural Web Audio engine
|   |-- engine/        # simulation state, behaviors, world logic
|   |-- scene/         # React Three Fiber scene components
|   `-- ui/            # overlay controls, status, debug, profiler
|-- firebase.json
|-- package.json
|-- vite.config.ts
`-- readme.md
```

---

## Local Development

### Prerequisites

- Node.js 20+
- npm
- Firebase CLI if you plan to deploy

### Install

```bash
npm install
```

### Start the dev server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview the production build locally

```bash
npm run preview
```

### Lint the codebase

```bash
npm run lint
```

---

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite development server |
| `npm run build` | Type-check and build the production bundle |
| `npm run preview` | Preview the built app locally |
| `npm run lint` | Run ESLint |
| `npm run bd` | Build and deploy to Firebase |

---

## Deployment

### GitHub

To publish the source to GitHub:

```bash
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Firebase Hosting

This repo already includes Firebase Hosting configuration:

- `public` directory is set to `dist`
- SPA routing rewrites all routes to `index.html`

Current deploy command:

```bash
npm run bd
```

If you are deploying under your own Firebase project:

1. Install the Firebase CLI
2. Run `firebase login`
3. Update `.firebaserc` with your Firebase project ID
4. Run `npm run bd`

---

## Notes

- The app is structured so the engine logic stays separate from rendering logic.
- The scene can fall back to procedural visuals where model assets are unavailable.
- The README is written for a GitHub audience, while the codebase itself is organized more like a simulation sandbox than a simple UI app.

---

## Recommended Additions For The Repo Page

If you want this GitHub repository to look even stronger, add these next:

1. A screenshot or animated GIF near the top of the README
2. A short demo link once Firebase Hosting is live
3. A Releases section if you version milestones publicly
4. A roadmap section for simulation features you plan to ship next

---

## License

No license file is currently included in this repository. Add one before open distribution if you want to define reuse terms clearly.