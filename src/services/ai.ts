import { getModelInstance, model as defaultModel } from "@/lib/firebase"

export type StreamChunkCallback = (partial: string) => void

/** User-facing copy when Vertex / Firebase returns 429 (common on busy Gemma tiers). */
export const VERTEX_RATE_LIMIT_USER_MESSAGE =
  "This model hit a temporary usage limit (too many requests). Open Settings and try another model — Gemini or Pollinations often work when Gemma is rate-limited."

export function isVertexRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  if (
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("resource exhausted") ||
    lower.includes("resource_exhausted")
  ) {
    return true
  }
  const o = err as { status?: number; code?: string | number; error?: { status?: number } }
  if (o?.status === 429 || o?.error?.status === 429) return true
  if (String(o?.code) === "429") return true
  return false
}

/** Citations / queries from Gemini Google Search grounding (when present). */
export interface WebGroundingInfo {
  webSearchQueries: string[]
  sources: { title: string; uri: string }[]
}

export type WebStreamProgressEvent =
  | { type: "phase"; phase: "searching" | "writing" }
  | { type: "grounding"; data: WebGroundingInfo }

export interface AIStreamResult {
  text: string
  grounding: WebGroundingInfo | null
}

export interface AICallOptions {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxOutputTokens?: number
  modelName?: string
  /** Enables Gemini grounding via web search when supported by the selected model. */
  enableWebSearch?: boolean
}

export interface ImageGenResult {
  dataUrl: string
  mimeType: string
  model: string
}

function isPollinationsTextModel(modelName: string): boolean {
  return modelName.startsWith("pollinations-text:")
}

function isPollinationsModel(modelName: string): boolean {
  return modelName.startsWith("pollinations:")
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Failed to read generated image bytes."))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

async function generateImageWithPollinations(prompt: string, modelName: string): Promise<ImageGenResult> {
  const model = modelName.replace("pollinations:", "").trim()
  if (!model) throw new Error("Invalid Pollinations model name.")

  const key = (import.meta.env.VITE_POLLINATIONS_API_KEY as string | undefined)?.trim()
  if (!key) {
    throw new Error(
      "Missing Pollinations API key. Set VITE_POLLINATIONS_API_KEY in your environment."
    )
  }

  const url = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}`)
  url.searchParams.set("model", model)
  url.searchParams.set("width", "1024")
  url.searchParams.set("height", "1024")
  const resp = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
    },
  })

  if (!resp.ok) {
    let detail = ""
    try {
      const raw = (await resp.json()) as {
        error?: { code?: string; message?: string }
        message?: string
      }
      detail = raw.error?.message ?? raw.message ?? ""
    } catch {
      try {
        detail = await resp.text()
      } catch {
        detail = ""
      }
    }
    throw new Error(
      `Pollinations image request failed: [${resp.status}] ${detail || resp.statusText || "Unknown error"}`
    )
  }

  const blob = await resp.blob()
  const mimeType = blob.type || "image/jpeg"
  const dataUrl = await toDataUrl(blob)
  return { dataUrl, mimeType, model: modelName }
}

async function callPollinationsTextModel({
  prompt,
  systemPrompt,
  modelName,
  temperature,
  maxOutputTokens,
}: {
  prompt: string
  systemPrompt?: string
  modelName: string
  temperature?: number
  maxOutputTokens?: number
}): Promise<string> {
  const model = modelName.replace("pollinations-text:", "").trim()
  if (!model) throw new Error("Invalid Pollinations text model name.")
  const key = (import.meta.env.VITE_POLLINATIONS_API_KEY as string | undefined)?.trim()
  if (!key) {
    throw new Error(
      "Missing Pollinations API key. Set VITE_POLLINATIONS_API_KEY (use a publishable pk_ key in frontend apps)."
    )
  }
  const messages: Array<{ role: "system" | "user"; content: string }> = []
  if (systemPrompt?.trim()) messages.push({ role: "system", content: systemPrompt.trim() })
  messages.push({ role: "user", content: prompt })

  const body: Record<string, unknown> = { model, messages }
  if (temperature !== undefined) body.temperature = temperature
  if (maxOutputTokens !== undefined) body.max_tokens = maxOutputTokens

  const resp = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    let detail = ""
    try {
      const raw = (await resp.json()) as {
        error?: { code?: string; message?: string }
        message?: string
        success?: boolean
      }
      detail = raw.error?.message ?? raw.message ?? ""
      if (!detail && raw.success === false) {
        detail = JSON.stringify(raw)
      }
    } catch {
      detail = await resp.text().catch(() => "")
    }
    throw new Error(
      `Pollinations text request failed: [${resp.status}] ${detail || resp.statusText || "Unknown error"}`
    )
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? ""
  if (!text) throw new Error("No text in Pollinations response")
  return text
}

function buildContents(prompt: string, systemPrompt?: string) {
  return systemPrompt
    ? [{ role: "user" as const, parts: [{ text: systemPrompt + "\n\n" + prompt }] }]
    : [{ role: "user" as const, parts: [{ text: prompt }] }]
}

function buildWebSearchTools(enableWebSearch?: boolean) {
  if (!enableWebSearch) return undefined
  // Firebase AI SDK typing can lag model/tool features; cast keeps this forward-compatible.
  return [{ googleSearch: {} }] as unknown as Record<string, unknown>[]
}

function isWebSearchToolUnsupportedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  return (
    lower.includes("400") ||
    lower.includes("invalid argument") ||
    lower.includes("googleSearch".toLowerCase()) ||
    lower.includes("tool") ||
    lower.includes("grounding")
  )
}

function parseGroundingMetadata(raw: unknown): WebGroundingInfo | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const webSearchQueries = Array.isArray(o.webSearchQueries)
    ? o.webSearchQueries.filter((q): q is string => typeof q === "string")
    : []
  const groundingChunks = Array.isArray(o.groundingChunks) ? o.groundingChunks : []
  const sources: { title: string; uri: string }[] = []
  for (const ch of groundingChunks) {
    if (!ch || typeof ch !== "object") continue
    const web = (ch as { web?: { uri?: string; title?: string } }).web
    if (web?.uri) {
      sources.push({ uri: web.uri, title: (web.title ?? web.uri).trim() || web.uri })
    }
  }
  if (webSearchQueries.length === 0 && sources.length === 0) return null
  return { webSearchQueries, sources }
}

function getGroundingMetadataFromChunk(chunk: unknown): unknown {
  if (!chunk || typeof chunk !== "object") return undefined
  const o = chunk as Record<string, unknown>
  const fromTop = o.candidates
  const resp = o.response
  const fromResp =
    resp && typeof resp === "object"
      ? (resp as Record<string, unknown>).candidates
      : undefined
  const candidates = (Array.isArray(fromTop) ? fromTop : fromResp) as unknown[] | undefined
  const first = candidates?.[0]
  if (!first || typeof first !== "object") return undefined
  return (first as Record<string, unknown>).groundingMetadata
}

function mergeWebGrounding(
  prev: WebGroundingInfo | null,
  next: WebGroundingInfo,
): WebGroundingInfo {
  if (!prev) return next
  const queries = [...new Set([...prev.webSearchQueries, ...next.webSearchQueries])]
  const byUri = new Map<string, { title: string; uri: string }>()
  for (const s of [...prev.sources, ...next.sources]) {
    byUri.set(s.uri, s)
  }
  return { webSearchQueries: queries, sources: [...byUri.values()] }
}

export async function callAI({
  prompt,
  systemPrompt,
  temperature = 0.7,
  maxOutputTokens = 2000,
  modelName,
  enableWebSearch,
}: AICallOptions): Promise<string> {
  if (modelName && isPollinationsTextModel(modelName)) {
    return callPollinationsTextModel({
      prompt,
      systemPrompt,
      modelName,
      temperature,
      maxOutputTokens,
    })
  }
  const activeModel = modelName ? getModelInstance(modelName) : defaultModel
  try {
    const result = await activeModel.generateContent({
      contents: buildContents(prompt, systemPrompt),
      generationConfig: { temperature, maxOutputTokens },
      tools: buildWebSearchTools(enableWebSearch),
    })

    const text = result.response.text()
    if (!text) throw new Error("No text in AI response")
    return text
  } catch (err) {
    // Some models (e.g. gemma variants) reject Google Search tools. Retry without tools.
    if (enableWebSearch && isWebSearchToolUnsupportedError(err)) {
      const result = await activeModel.generateContent({
        contents: buildContents(prompt, systemPrompt),
        generationConfig: { temperature, maxOutputTokens },
      })
      const text = result.response.text()
      if (!text) throw new Error("No text in AI response")
      return text
    }
    throw err
  }
}

/**
 * Like callAI but streams the response token-by-token.
 * Calls onChunk with each incremental text piece.
 * Returns the full assembled text and optional web grounding metadata when done.
 */
export async function callAIStream({
  prompt,
  systemPrompt,
  temperature = 0.7,
  maxOutputTokens = 2000,
  modelName,
  enableWebSearch,
  onChunk,
  onStreamProgress,
}: AICallOptions & {
  onChunk: StreamChunkCallback
  /** Fired for search phase changes and merged grounding updates (queries / sources). */
  onStreamProgress?: (evt: WebStreamProgressEvent) => void
}): Promise<AIStreamResult> {
  if (modelName && isPollinationsTextModel(modelName)) {
    onStreamProgress?.({ type: "phase", phase: "writing" })
    const text = await callPollinationsTextModel({
      prompt,
      systemPrompt,
      modelName,
      temperature,
      maxOutputTokens,
    })
    onChunk(text)
    return { text, grounding: null }
  }
  const activeModel = modelName ? getModelInstance(modelName) : defaultModel
  let result: Awaited<ReturnType<typeof activeModel.generateContentStream>>
  try {
    result = await activeModel.generateContentStream({
      contents: buildContents(prompt, systemPrompt),
      generationConfig: { temperature, maxOutputTokens },
      tools: buildWebSearchTools(enableWebSearch),
    })
  } catch (err) {
    // If web tools are unsupported by the selected model, retry without them.
    if (enableWebSearch && isWebSearchToolUnsupportedError(err)) {
      onStreamProgress?.({ type: "phase", phase: "writing" })
      result = await activeModel.generateContentStream({
        contents: buildContents(prompt, systemPrompt),
        generationConfig: { temperature, maxOutputTokens },
      })
    } else {
      throw err
    }
  }

  let full = ""
  let grounding: WebGroundingInfo | null = null
  let sawText = false

  for await (const chunk of result.stream) {
    const gmRaw = getGroundingMetadataFromChunk(chunk)
    const parsed = parseGroundingMetadata(gmRaw)
    if (parsed) {
      grounding = mergeWebGrounding(grounding, parsed)
      onStreamProgress?.({ type: "grounding", data: grounding })
      // Only show "searching" in the UI when the API actually returned web-grounding data —
      // do not imply a search on every request with tools enabled.
      if (
        enableWebSearch &&
        !sawText &&
        (parsed.webSearchQueries.length > 0 || parsed.sources.length > 0)
      ) {
        onStreamProgress?.({ type: "phase", phase: "searching" })
      }
    }

    const piece = chunk.text()
    if (piece) {
      if (!sawText && enableWebSearch) {
        sawText = true
        onStreamProgress?.({ type: "phase", phase: "writing" })
      }
      full += piece
      onChunk(piece)
    }
  }

  // Some SDK builds only attach full grounding on the aggregated stream response.
  try {
    const streamResult = result as { response?: Promise<unknown> }
    if (typeof streamResult.response?.then === "function") {
      const aggregated = await streamResult.response
      const gmRaw = getGroundingMetadataFromChunk(aggregated)
      const parsed = parseGroundingMetadata(gmRaw)
      if (parsed) {
        grounding = mergeWebGrounding(grounding, parsed)
        onStreamProgress?.({ type: "grounding", data: grounding })
      }
    }
  } catch {
    /* non-fatal */
  }

  if (!full) throw new Error("No text in AI stream response")
  return { text: full, grounding }
}

export async function callAIStructured<T = Record<string, unknown>>({
  prompt,
  systemPrompt,
  temperature = 0.3,
  maxOutputTokens = 2000,
  modelName,
}: AICallOptions): Promise<T> {

  const text = await callAI({ prompt, systemPrompt, temperature, maxOutputTokens, modelName })

  
  try {
    console.log("=== ATTEMPT 1: Direct JSON.parse ===")
    const result = JSON.parse(text) as T
    console.log("✓ Success!")
    return result
  } catch (e) {
    console.log("✗ Failed:", e instanceof Error ? e.message : String(e))

    console.log("=== ATTEMPT 2: Extract from markdown blocks ===")
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (markdownMatch && markdownMatch[1]) {
      console.log("Found markdown block, extracted length:", markdownMatch[1].length)
      try {
        const result = JSON.parse(markdownMatch[1]) as T
        console.log("✓ Success!")
        return result
      } catch (e2) {
        console.log("✗ Failed:", e2 instanceof Error ? e2.message : String(e2))
      }
    }

    console.log("=== ATTEMPT 3: Extract first { to last } ===")
    const jsonStart = text.indexOf("{")
    const jsonEnd = text.lastIndexOf("}")
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const extracted = text.substring(jsonStart, jsonEnd + 1)
      try {
        const result = JSON.parse(extracted) as T
        console.log("✓ Success!")
        return result
      } catch (e3) {
        console.log("✗ Failed:", e3 instanceof Error ? e3.message : String(e3))
      }
    }

    console.log("=== ALL ATTEMPTS FAILED ===")
    throw new Error(`AI response is not valid JSON: ${e instanceof Error ? e.message : "Unknown error"}`)
  }
}

export async function generateImage({
  prompt,
  modelName,
}: {
  prompt: string
  modelName: string
}): Promise<ImageGenResult> {
  if (isPollinationsModel(modelName)) {
    return generateImageWithPollinations(prompt, modelName)
  }
  throw new Error(
    `Unsupported image model "${modelName}". This app is configured for Pollinations image models only.`
  )
}
