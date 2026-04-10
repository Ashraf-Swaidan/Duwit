# Desktop Release Flow (Windows)

Firebase Hosting on Spark cannot serve `.exe` files, so desktop installers are distributed from GitHub Releases.

## One-time prerequisites

- `public/logo.ico` must include a 256x256 icon layer.
- Install dependencies at least once in this repo (`npm install`).

## Release steps

1. Bump app version in `package.json`.
2. Build installer:

```bash
npm run dist:win
```

3. Create or open a GitHub release (usually tag `vX.Y.Z`) and upload:

- `release/Duwit-Setup-<version>.exe`

4. Deploy web app to Firebase Hosting:

```bash
npm run build
firebase deploy --only hosting
```

## Result

Users can download the latest desktop installer from:

- `https://github.com/Ashraf-Swaidan/Duwit/releases/latest`

Landing pages can link directly to the latest releases page.
