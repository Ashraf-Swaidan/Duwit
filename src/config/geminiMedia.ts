/**
 * Gemini media models (TTS + Live native audio).
 * Override via env when Google publishes new IDs (e.g. Gemini 3 Flash Live).
 *
 * @see https://ai.google.dev/gemini-api/docs/speech-generation
 * @see https://firebase.google.com/docs/ai-logic/live-api
 */
export const GEMINI_TTS_MODEL =
  (import.meta.env.VITE_GEMINI_TTS_MODEL as string | undefined) ?? "gemini-2.5-flash-preview-tts"

/** Live API: bidirectional voice — 2.5 “Native Audio Dialog” (Gemini Developer API default in docs). */
export const GEMINI_LIVE_NATIVE_AUDIO_MODEL =
  (import.meta.env.VITE_GEMINI_LIVE_MODEL as string | undefined) ??
  "gemini-2.5-flash-native-audio-preview-12-2025"

/**
 * Live API: Gemini 3.1 Flash Live (low-latency A2A). Override via env if Google renames the preview ID.
 * @see https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview
 */
export const GEMINI_31_FLASH_LIVE_MODEL =
  (import.meta.env.VITE_GEMINI_31_FLASH_LIVE_MODEL as string | undefined) ?? "gemini-3.1-flash-live-preview"

/** Settings key: which Live voice stack to use for task voice calls. */
export type VoiceLiveModelChoice = "gemini31FlashLive" | "gemini25NativeAudio"

export function resolveVoiceLiveModelId(choice: VoiceLiveModelChoice): string {
  return choice === "gemini31FlashLive" ? GEMINI_31_FLASH_LIVE_MODEL : GEMINI_LIVE_NATIVE_AUDIO_MODEL
}

export const GEMINI_TTS_VOICE_NAME =
  (import.meta.env.VITE_GEMINI_TTS_VOICE as string | undefined) ?? "Kore"
