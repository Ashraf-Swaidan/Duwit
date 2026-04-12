import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  // Use relative asset paths so Electron file:// production loads work.
  base: "./",
  plugins: [
    TanStackRouterVite(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.svg", "logo.png", "logo.ico"],
      manifest: {
        name: "Duwit",
        short_name: "Duwit",
        description:
          "Duwit turns your goals into guided plans—chat through what you want, work tasks with teaching and checks, and keep finished journeys out of the way.",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        display_override: ["standalone", "browser"],
        orientation: "portrait-primary",
        scope: "./",
        start_url: "./",
        icons: [
          {
            src: "logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "logo.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
      workbox: {
        // Default 2 MiB rejects large bundles; main chunk can exceed that after minification.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // kB; main bundle includes heavy deps (charts, markdown, mermaid path, etc.)
    chunkSizeWarningLimit: 3000,
  },
})
