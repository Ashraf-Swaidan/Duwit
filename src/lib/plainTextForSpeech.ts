/**
 * Coarse markdown/widget stripping for TTS — keeps spoken output understandable without SSML.
 * Collapses to a single line (used for browser speechSynthesis fallback).
 */
export function plainTextForSpeech(markdownish: string): string {
  return paragraphsForSpeech(markdownish).join(" ").replace(/\s+/g, " ").trim()
}

/**
 * One paragraph per element — used to chunk Gemini TTS so each request stays within audio limits
 * and the next paragraph can be fetched while the previous plays.
 */
export function paragraphsForSpeech(markdownish: string): string[] {
  let t = markdownish
  t = t.replace(/```[\s\S]*?```/g, "\n\n")
  t = t.replace(/`([^`]+)`/g, "$1")
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  t = t.replace(/^#{1,6}\s+/gm, "")
  t = t.replace(/^\s*[-*+]\s+/gm, "")
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1")
  t = t.replace(/\*([^*]+)\*/g, "$1")
  t = t.replace(/__([^_]+)__/g, "$1")
  t = t.replace(/_([^_]+)_/g, "$1")
  t = t.replace(/\r\n/g, "\n")
  const blocks = t.split(/\n\n+/).map((p) => p.replace(/[ \t]+/g, " ").replace(/\n+/g, " ").trim())
  const out = blocks.filter(Boolean)
  return out.length > 0 ? out : [t.replace(/\s+/g, " ").trim()].filter(Boolean)
}
