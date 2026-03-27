import {
  getGenerativeModel,
  type GenerationConfig,
  type SpeechConfig,
  ResponseModality,
} from "firebase/ai"
import { ai } from "@/lib/firebase"
import { GEMINI_TTS_MODEL, GEMINI_TTS_VOICE_NAME } from "@/config/geminiMedia"

/** Larger chunks = fewer API calls; split only when over limit. Paragraph merge still applies. */
const MAX_CHARS_PER_TTS_CHUNK = 4000

/**
 * Monotonic id so only the newest `startGeminiTtsPlayback` may schedule audio.
 * Prevents overlapping voices when a new Listen/auto-read supersedes a prior run before abort settles.
 */
let ttsPlaybackGeneration = 0

function ttsGenerationConfig(): GenerationConfig & { speechConfig?: SpeechConfig } {
  return {
    responseModalities: [ResponseModality.AUDIO],
    /** Long assistant replies can exceed default audio caps; raise to reduce mid-message cutoffs. */
    maxOutputTokens: 8192,
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE_NAME },
      },
    },
  }
}

function getTtsModel() {
  return getGenerativeModel(ai, {
    model: GEMINI_TTS_MODEL,
    generationConfig: ttsGenerationConfig(),
  })
}

function pcmBase64ToAudioBuffer(
  ctx: AudioContext,
  base64: string,
  sampleRate: number,
): AudioBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const dataInt16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
  const frameCount = dataInt16.length
  const buffer = ctx.createBuffer(1, frameCount, sampleRate)
  const ch = buffer.getChannelData(0)
  for (let i = 0; i < frameCount; i++) ch[i] = dataInt16[i]! / 32768
  return buffer
}

async function inlineAudioToBuffer(
  ctx: AudioContext,
  mimeType: string,
  base64: string,
): Promise<AudioBuffer> {
  const lower = mimeType.toLowerCase()
  if (lower.includes("wav")) {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    return await ctx.decodeAudioData(copy)
  }
  const rate = parseSampleRateFromMime(mimeType)
  return pcmBase64ToAudioBuffer(ctx, base64, rate)
}

function parseSampleRateFromMime(mime: string): number {
  const m = /rate=(\d+)/i.exec(mime)
  return m ? parseInt(m[1]!, 10) : 24000
}

/** Merge paragraph-sized strings into request-sized chunks without splitting mid-paragraph when possible. */
export function mergeParagraphsIntoTtsChunks(paragraphs: string[], maxChars: number): string[] {
  const chunks: string[] = []
  let cur = ""
  for (const p of paragraphs) {
    if (!p) continue
    if (p.length > maxChars) {
      if (cur) {
        chunks.push(cur)
        cur = ""
      }
      for (let i = 0; i < p.length; i += maxChars) {
        chunks.push(p.slice(i, i + maxChars))
      }
      continue
    }
    const joiner = cur ? "\n\n" : ""
    if (cur.length + joiner.length + p.length <= maxChars) {
      cur += joiner + p
    } else {
      if (cur) chunks.push(cur)
      cur = p
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}

export type GeminiTtsHandle = {
  /** Resolves when playback finishes, is cancelled, or errors (errors reject). */
  done: Promise<void>
  pause: () => void
  resume: () => void
  cancel: () => void
}

type StartOpts = {
  signal?: AbortSignal
  /** Fired once the first audio buffer is scheduled (good moment to switch UI from loading → playing). */
  onFirstAudioScheduled?: () => void
}

/**
 * Gemini TTS with **prefetch** of the next chunk while the current chunk plays, completion via last
 * `AudioBufferSourceNode` `onended`, and **resume** when the tab becomes visible if the browser suspended audio.
 */
export function startGeminiTtsPlayback(
  paragraphs: string[],
  { signal: externalSignal, onFirstAudioScheduled }: StartOpts = {},
): GeminiTtsHandle {
  const myGeneration = ++ttsPlaybackGeneration
  const chunks = mergeParagraphsIntoTtsChunks(paragraphs, MAX_CHARS_PER_TTS_CHUNK)
  const internal = new AbortController()
  const mergedSignal = externalSignal
    ? (() => {
        if (externalSignal.aborted) internal.abort()
        else externalSignal.addEventListener("abort", () => internal.abort(), { once: true })
        return internal.signal
      })()
    : internal.signal

  let paused = false
  let ctxRef: AudioContext | null = null
  let firstScheduled = false

  const superseded = () => myGeneration !== ttsPlaybackGeneration

  const run = async () => {
    const trimmedChunks = chunks.map((c) => c.trim()).filter(Boolean)
    if (trimmedChunks.length === 0) return
    if (superseded()) return

    const ctx = new AudioContext({ sampleRate: 24000 })
    ctxRef = ctx
    await ctx.resume()
    if (superseded()) {
      await ctx.close()
      return
    }

    const tryResumeIfNotUserPaused = () => {
      if (paused) return
      const c = ctxRef
      if (c && c.state === "suspended") void c.resume().catch(() => undefined)
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") tryResumeIfNotUserPaused()
    }
    const onCtxState = () => {
      tryResumeIfNotUserPaused()
    }
    document.addEventListener("visibilitychange", onVisibility)
    ctx.addEventListener("statechange", onCtxState)

    try {
    const model = getTtsModel()
    let nextTime = ctx.currentTime

    const fetchChunkAudio = async (index: number) => {
      const chunk = trimmedChunks[index]!
      if (mergedSignal.aborted || superseded()) return { buffers: [] as AudioBuffer[], duration: 0 }
      const prompt =
        `Speak the following text verbatim for a learner. Do not add a title, preamble, or meta commentary. ` +
        `Continue in the same tone as earlier if this is a continuation of a longer reply:\n\n${chunk}`

      const result = await model.generateContent(
        { contents: [{ role: "user", parts: [{ text: prompt }] }] },
        { signal: mergedSignal },
      )

      if (superseded()) return { buffers: [] as AudioBuffer[], duration: 0 }

      const parts = result.response.inlineDataParts()
      if (!parts?.length) throw new Error("No audio in TTS response")

      const buffers: AudioBuffer[] = []
      for (const part of parts) {
        if (mergedSignal.aborted || superseded()) break
        const { mimeType, data } = part.inlineData
        buffers.push(await inlineAudioToBuffer(ctx, mimeType, data))
      }
      const duration = buffers.reduce((s, b) => s + b.duration, 0)
      return { buffers, duration }
    }

    const waitWhilePaused = async () => {
      while (paused && !mergedSignal.aborted && !superseded()) {
        await new Promise((r) => setTimeout(r, 60))
      }
    }

    const bufferEndPromises: Promise<void>[] = []
    let nextChunkPromise: Promise<{ buffers: AudioBuffer[]; duration: number }> = fetchChunkAudio(0)

    for (let i = 0; i < trimmedChunks.length; i++) {
      if (mergedSignal.aborted || superseded()) break
      await waitWhilePaused()
      if (mergedSignal.aborted || superseded()) break

      const { buffers } = await nextChunkPromise
      if (superseded()) break

      if (i + 1 < trimmedChunks.length) {
        nextChunkPromise = fetchChunkAudio(i + 1)
      }

      for (const buffer of buffers) {
        if (mergedSignal.aborted || superseded()) break
        await waitWhilePaused()
        if (mergedSignal.aborted || superseded()) break

        const src = ctx.createBufferSource()
        src.buffer = buffer
        src.connect(ctx.destination)
        bufferEndPromises.push(
          new Promise<void>((res) => {
            src.onended = () => res()
          }),
        )
        src.start(nextTime)
        nextTime += buffer.duration
        if (!firstScheduled) {
          firstScheduled = true
          onFirstAudioScheduled?.()
        }
      }
    }

    if (bufferEndPromises.length > 0) {
      await Promise.race([
        Promise.all(bufferEndPromises),
        new Promise<void>((resolve) => mergedSignal.addEventListener("abort", () => resolve(), { once: true })),
      ])
    }
    } finally {
      document.removeEventListener("visibilitychange", onVisibility)
      ctx.removeEventListener("statechange", onCtxState)
    }
  }

  const done = run().finally(async () => {
    if (ctxRef) {
      try {
        await ctxRef.close()
      } catch {
        /* ignore */
      }
      ctxRef = null
    }
  })

  return {
    done,
    pause: () => {
      paused = true
      void ctxRef?.suspend()
    },
    resume: () => {
      paused = false
      void ctxRef?.resume()
    },
    cancel: () => {
      internal.abort()
      ttsPlaybackGeneration++
      void ctxRef?.close()
    },
  }
}

export async function playGeminiTts(
  paragraphs: string[],
  opts: { signal?: AbortSignal } = {},
): Promise<void> {
  const h = startGeminiTtsPlayback(paragraphs, opts)
  await h.done
}

export function speakWithBrowserTts(text: string, lang?: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(text)
  if (lang) u.lang = lang
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}
