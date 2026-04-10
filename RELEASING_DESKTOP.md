# Desktop Release Flow (Windows)

This project publishes the desktop installer to a stable website path:

- `/downloads/Duwit-Setup-latest.exe`

## One-time prerequisites

- `public/logo.ico` must include a 256x256 icon layer.
- Install dependencies at least once in this repo (`npm install`).

## Release steps

1. Bump app version in `package.json`.
2. Build installer and copy it to hosted downloads:

```bash
npm run dist:win:publish-local
```

3. Deploy web + download artifact to Firebase Hosting:

```bash
npm run build
firebase deploy --only hosting
```

## Result

Users can always download the latest Windows installer from:

- `/downloads/Duwit-Setup-latest.exe`

You can link this directly in landing pages and marketing pages.
