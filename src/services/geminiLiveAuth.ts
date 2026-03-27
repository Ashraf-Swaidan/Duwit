/**
 * Optional: point `VITE_GEMINI_EPHEMERAL_TOKEN_URL` at your backend that returns
 * `{ "token": "..." }` for Gemini Live client auth (recommended for production).
 * When unset, Firebase AI uses the project Google AI connection from the client config.
 */
export async function fetchGeminiLiveEphemeralToken(): Promise<string | null> {
  const url = import.meta.env.VITE_GEMINI_EPHEMERAL_TOKEN_URL as string | undefined
  if (!url?.trim()) return null
  try {
    const res = await fetch(url, { credentials: "include" })
    if (!res.ok) return null
    const data = (await res.json()) as { token?: string }
    return typeof data.token === "string" ? data.token : null
  } catch {
    return null
  }
}
