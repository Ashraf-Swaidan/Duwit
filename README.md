# Duwit

Duwit is a goal coaching app that helps you go from "I want to do this" to "I actually finished this."

You talk through a goal, Duwit turns it into phases and tasks, then teaches you inside each task with follow-up context instead of starting over every time.

It ships as both:

- a web app
- a Windows desktop app (Electron)

## What Duwit feels like

- You can define goals in plain language, not rigid forms.
- Plans are broken into phases and practical task steps.
- Task chat remembers what happened earlier in the same goal.
- Completed goals move out of your way so active work stays focused.
- Landing page is designed to show the "generic AI advice vs guided execution" contrast.

## Stack

- React 19 + TypeScript + Vite
- TanStack Router + TanStack Query
- Tailwind CSS
- Firebase (Auth, Firestore, Analytics, AI SDK)
- Electron + electron-builder (Windows packaging)

## Project map

- `src/pages` - user-facing screens (landing, app, goals, planning)
- `src/components` - reusable UI and feature components
- `src/routes` - router entries and guarded app routes
- `src/services` - AI prompts, goal logic, persistence helpers
- `src/lib` - shared utilities (Firebase setup, live audio, etc.)
- `electron` - desktop main/preload runtime

## Environment variables

Create a `.env` file at the root.

### Required

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Optional

- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_GEMINI_MODEL`
- `VITE_GEMINI_TTS_MODEL`
- `VITE_GEMINI_LIVE_MODEL`
- `VITE_GEMINI_31_FLASH_LIVE_MODEL`
- `VITE_GEMINI_TTS_VOICE`
- `VITE_GEMINI_EPHEMERAL_TOKEN_URL`
- `VITE_POLLINATIONS_API_KEY`

## Local development

Install dependencies manually first, then:

```bash
npm run dev
```

Desktop dev:

```bash
npm run dev:electron
```

## Build, desktop packaging, and website download

Build app:

```bash
npm run build
```

Run built desktop runtime:

```bash
npm run start:electron
```

Build Windows installer:

```bash
npm run dist:win
```

Build Windows installer:

```bash
npm run dist:win
```

Firebase Hosting (Spark) cannot host `.exe` files, so publish installers via GitHub Releases:

- [Latest desktop release](https://github.com/Ashraf-Swaidan/Duwit/releases/latest)

For the full release process, see `RELEASING_DESKTOP.md`.

## Firebase Hosting deploy

Manual deploy:

```bash
npm run build
firebase deploy --only hosting
```

If GitHub Actions is configured, pushes to `master` can auto-deploy the web app.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run format
```

