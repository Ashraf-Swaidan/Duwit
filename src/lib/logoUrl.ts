/**
 * Public `logo.svg` URL that works on deep SPA routes and Electron `file://` loads.
 * `${BASE_URL}logo.svg` breaks when BASE_URL is `./` and the route is e.g. `/plan/...`
 * because the browser resolves `./logo.svg` relative to the path segment.
 */
export function getLogoUrl(): string {
  if (typeof window === "undefined") return "/logo.svg"
  if (window.location.protocol === "file:") {
    return new URL("logo.svg", window.location.href).href
  }
  const base = import.meta.env.BASE_URL
  if (base.startsWith("/")) {
    const prefix = base.endsWith("/") ? base : `${base}/`
    return `${prefix}logo.svg`
  }
  return new URL("/logo.svg", window.location.origin).href
}
