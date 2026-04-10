# Duwit

Duwit is an AI execution platform for people who want to finish meaningful goals, not just talk about them. It serves learners, builders, and professionals who need a practical path from intent to completion.

Most AI products stop at encouragement. Duwit operationalizes progress: it turns a vague goal into a structured roadmap, teaches inside each task, checks understanding with quizzes, and carries context forward so users do not restart from zero every session.

## Why This Exists

People usually fail goals for process reasons, not motivation reasons:
- planning friction is high at the start,
- guidance becomes generic once tasks get specific,
- progress context gets lost across sessions,
- and completed work is not converted into reusable momentum.

Duwit solves this by combining planning, instruction, memory, and execution UX in one loop.

## Core Power Points

- **Goal-to-roadmap conversion:** conversational goal discovery becomes phased execution plans with concrete tasks.
- **Task-scoped coaching:** each checklist task opens into a dedicated AI teaching flow instead of broad, drifting chat.
- **Memory-driven personalization:** user profile, per-goal profile, and rolling goal state are injected into prompts to keep guidance consistent and cumulative.
- **Built-in mastery checks:** adaptive quiz flow (pass/fail/recap) validates understanding before a task is considered complete.
- **Execution-first UX:** active goals are prioritized, completed journeys are archived cleanly, and navigation is designed for fast return-to-work.
- **Multi-surface delivery:** same product loop ships as web and Windows desktop.

## What I Achieved Building This

- Designed and shipped a full AI coaching product that moves users from idea to finished outcome.
- Implemented durable learning continuity across chats with Firestore-backed task history and synthesized goal memory.
- Built a portfolio-grade UX that balances conversational intelligence with operational control and low cognitive load.
- Delivered production-ready web + desktop packaging with release workflow support.

## Main Modules And Features

- **Home Concierge (`/app`)**: contextual greeting, goal-aware suggestions, and navigation intents into the right workflow.
- **Goal Intake + Plan Generation (`/new-goal`)**: structured conversational discovery, plan-ready detection, JSON roadmap generation, and curriculum expansion.
- **Plan Execution Workspace (`/plan/$goalId`)**: phase/task tracking, progress analytics, completion celebration, and side-by-side task coaching.
- **Task Coaching Engine (`TaskChat`)**: teaching phases, adaptive quizzes, recap loop, voice panel, TTS, web-grounded responses, and multimedia widgets.
- **Goals Portfolio (`/goals`)**: active vs completed segmentation, recency ordering, and clean lifecycle management.
- **Cross-platform Shell**: responsive web shell plus Electron desktop window controls and packaging.

## Technical Architecture

### Stack
- React 19 + TypeScript + Vite
- TanStack Router + TanStack Query
- Tailwind CSS + Radix UI primitives + motion
- Firebase Auth + Firestore + Analytics + Firebase AI SDK
- Gemini models and Pollinations integrations for text/image generation
- Electron + electron-builder for Windows distribution

### Data Flow
- Authenticated user enters goal context through route-guarded pages.
- Goal planning flow generates structured roadmap JSON, then expands task micro-curriculum.
- Firestore persists goals under user scope (`users/{uid}/goals`) and task chat docs (`taskChats`).
- Task interactions update both local task state and a summarized `goalState` memory for future prompt grounding.
- Query invalidation keeps home/goals/plan views consistent after updates.

### Auth, Permissions, Governance
- Firebase Auth is required for app routes via `RequireAuth`.
- Data is scoped by `uid` in Firestore document paths.
- Chat persistence avoids unsafe undefined nesting and uses validated persistence parsing.
- Route-level guardrails and scoped writes provide practical per-user isolation.
- No enterprise RBAC layer is implemented at this stage (single-user ownership model).

### Reporting And Progress Signals
- Goal-level progress: task completion ratio and status transitions.
- Task-level outcomes: quiz scores, weak topics, and recap outcomes.
- Activity recency tracking: `lastActivityAt` and touched phase/task indexes.
- Completion lifecycle: active -> completed states with vault-style archival UX.

### Integrations
- Firebase services: Auth, Firestore, Analytics, AI.
- Gemini text/streaming/structured outputs and live voice model support.
- Pollinations APIs for image generation and optional text model paths.
- GitHub Releases for desktop installer distribution.

### Platform Targets
- Web app (responsive mobile and desktop UX).
- Windows desktop app via Electron (`frame: false`, custom title bar, desktop controls).

## Repository Map

- `src/routes`: route definitions and app shell orchestration.
- `src/pages`: route-level pages (landing, planning workspace, goal list, etc.).
- `src/components`: major UI building blocks and high-value feature components.
- `src/services`: business logic for goals, AI orchestration, prompts, memory, and persistence.
- `src/hooks`: reusable stateful workflow hooks (`useAuth`, `useTaskTeaching`, media helpers).
- `src/contexts`: model/profile/live-voice contexts.
- `src/lib`: Firebase bootstrap and shared utilities.
- `src/config`: model/media configuration.
- `src/types`: shared domain types (curriculum and environment typing).
- `electron`: desktop runtime entrypoints (`main`, `preload`).
- `build`: installer scripts and packaging support.
- `public`: brand assets and landing collateral.
- `.github/workflows`: deployment automation.

## Setup, Run, Build

Create `.env` in project root.

### Required Environment Variables
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Optional Environment Variables
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_GEMINI_MODEL`
- `VITE_GEMINI_TTS_MODEL`
- `VITE_GEMINI_LIVE_MODEL`
- `VITE_GEMINI_31_FLASH_LIVE_MODEL`
- `VITE_GEMINI_TTS_VOICE`
- `VITE_GEMINI_EPHEMERAL_TOKEN_URL`
- `VITE_POLLINATIONS_API_KEY`

### Install And Run
Install dependencies manually, then:

```bash
npm run dev
```

Desktop development:

```bash
npm run dev:electron
```

### Build And Package
Web + electron build:

```bash
npm run build
```

Run packaged desktop runtime:

```bash
npm run start:electron
```

Build Windows installer:

```bash
npm run dist:win
```

Optional portable build:

```bash
npm run dist:portable
```

Desktop installers are published via GitHub Releases:
- [Latest desktop release](https://github.com/Ashraf-Swaidan/Duwit/releases/latest)

Release details: `RELEASING_DESKTOP.md`

### Deploy Web

```bash
npm run build
firebase deploy --only hosting
```

### Quality Checks

```bash
npm run typecheck
npm run lint
npm run format
```

## For AI Agents / Contributors

Start here before editing:
- Read `src/services/goals.ts` for canonical domain types (`Goal`, `Phase`, `Task`, `GoalState`).
- Read `src/services/taskTeaching.ts` and `src/hooks/useTaskTeaching.ts` for teaching/quiz lifecycle contracts.
- Read `src/services/ai.ts` and `src/services/prompts.ts` for model/tool orchestration and output expectations.
- Read `src/pages/PlanView.tsx` + `src/components/TaskChat.tsx` for execution UX behavior.
- Preserve task-scope boundaries: each task chat teaches one checklist row, not adjacent siblings.
- Keep Firestore payloads schema-safe (no nested undefined values).
- Maintain route guard and user-scoped data access patterns.

## Vision

Duwit aims to become the default execution layer for ambitious people: a product where strategy, learning, and daily action stay connected until the goal is actually done.

