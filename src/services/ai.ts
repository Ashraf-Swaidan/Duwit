import { getModelInstance, model as defaultModel } from "@/lib/firebase"

export type StreamChunkCallback = (partial: string) => void

export interface AICallOptions {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxOutputTokens?: number
  modelName?: string
}

export async function callAI({
  prompt,
  systemPrompt,
  temperature = 0.7,
  maxOutputTokens = 2000,
  modelName,
}: AICallOptions): Promise<string> {
  const activeModel = modelName ? getModelInstance(modelName) : defaultModel

  const contents = systemPrompt
    ? [{ role: "user" as const, parts: [{ text: systemPrompt + "\n\n" + prompt }] }]
    : [{ role: "user" as const, parts: [{ text: prompt }] }]

  const result = await activeModel.generateContent({
    contents,
    generationConfig: { temperature, maxOutputTokens },
  })

  const text = result.response.text()
  if (!text) throw new Error("No text in AI response")
  return text
}

/**
 * Like callAI but streams the response token-by-token.
 * Calls onChunk with each incremental text piece.
 * Returns the full assembled text when done.
 */
export async function callAIStream({
  prompt,
  systemPrompt,
  temperature = 0.7,
  maxOutputTokens = 2000,
  modelName,
  onChunk,
}: AICallOptions & { onChunk: StreamChunkCallback }): Promise<string> {
  const activeModel = modelName ? getModelInstance(modelName) : defaultModel

  const contents = systemPrompt
    ? [{ role: "user" as const, parts: [{ text: systemPrompt + "\n\n" + prompt }] }]
    : [{ role: "user" as const, parts: [{ text: prompt }] }]

  const result = await activeModel.generateContentStream({
    contents,
    generationConfig: { temperature, maxOutputTokens },
  })

  let full = ""
  for await (const chunk of result.stream) {
    const piece = chunk.text()
    if (piece) {
      full += piece
      onChunk(piece)
    }
  }

  if (!full) throw new Error("No text in AI stream response")
  return full
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
