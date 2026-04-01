# React + TypeScript + Vite + shadcn/ui

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Electron desktop app

This project can now run as a desktop app with Electron.

### 1) Install desktop dependencies (manual)

```bash
npm install
```

### 2) Run desktop app in development

```bash
npm run dev:electron
```

### 3) Build for desktop runtime

```bash
npm run build
```

Then launch the built desktop runtime:

```bash
npm run start:electron
```

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```
