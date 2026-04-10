# Platform Delivery And Integrations

## Why This Module Stands Out

Duwit is not a prototype locked to one surface. It ships a consistent product loop across browser and Windows desktop, with AI model flexibility and release packaging baked into the repository.

## High-Impact Capabilities

- Shared app codebase for web and Electron runtime.
- Custom desktop window chrome and IPC controls (minimize/maximize/close).
- Build pipeline that compiles app and electron targets together.
- Windows installer and portable packaging via electron-builder.
- Integrated model routing for Gemini and Pollinations capabilities.

## Workflow Depth And Operational Strengths

Delivery design centers on practical use:

- Desktop runtime supports focused usage with native window controls.
- Web delivery supports broad accessibility and quick onboarding.
- Release process includes artifact generation and distribution path through GitHub Releases.

This dual-surface strategy improves adoption by meeting users where they already work.

## Security, Permissions, Governance

- Electron runs with `contextIsolation: true`, `nodeIntegration: false`, and sandbox enabled.
- Preload bridge limits renderer access to explicit IPC handlers.
- Installer settings include explicit app identity and controlled packaging assets.

## Business Value And Outcomes

- Expands total addressable usage contexts (browser + native desktop).
- Improves trust and usability for users who prefer installable tools.
- De-risks product growth by keeping one maintained codebase across surfaces.

## Key Implementation Areas

- `electron/main.ts`
- `electron/preload.cts`
- `src/components/DesktopTitleBar.tsx`
- `package.json`
- `vite.config.ts`
- `RELEASING_DESKTOP.md`
