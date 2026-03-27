import { getModelInstance, model as defaultModel } from "@/lib/firebase"

export type StreamChunkCallback = (partial: string) => void

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
