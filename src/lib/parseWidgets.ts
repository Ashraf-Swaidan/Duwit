export type WidgetType =
  | "chart"
  | "table"
  | "mermaid"
  | "flashcards"
  | "comparison"
  | "timeline"
  | "code"
  | "checklist"
  | "youtube" // backward-compatible with existing duwit blocks

export const WIDGET_TYPES: readonly WidgetType[] = [
  "chart",
  "table",
  "mermaid",
  "flashcards",
  "comparison",
  "timeline",
  "code",
  "checklist",
  "youtube",
] as const

export interface Widget {
  type: WidgetType
  title?: string
  data: Record<string, unknown>
}

export interface ParsedContent {
  segments: Array<
    | { kind: "text"; content: string }
    | { kind: "widget"; widget: Widget }
  >
}

function isWidgetType(t: string): t is WidgetType {
  return (WIDGET_TYPES as readonly string[]).includes(t)
}

function widgetFromParsedData(data: Record<string, unknown>): Widget | null {
  const type = (data.type as string) || ""
  if (!isWidgetType(type)) return null
  return {
    type,
    title: (data.title as string | undefined) || undefined,
    data,
  }
}

/** Strip ```json ... ``` or ``` ... ``` wrapper if present. */
function unwrapMarkdownFence(s: string): string {
  const t = s.trim()
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return m ? m[1].trim() : t
}

/**
 * Extract first balanced `{ ... }` from a string (handles strings and escapes crudely).
 */
export function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf("{")
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === "\\" && inString) {
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (!inString) {
      if (c === "{") depth++
      else if (c === "}") {
        depth--
        if (depth === 0) return s.slice(start, i + 1)
      }
    }
  }
  return null
}

/** Parse raw JSON object text into a widget if `type` is known. */
export function tryParseLooseWidgetJson(jsonText: string): Widget | null {
  const inner = unwrapMarkdownFence(jsonText)
  const candidate = inner.trim().startsWith("{") ? inner.trim() : extractFirstJsonObject(inner) ?? inner.trim()
  try {
    const data = JSON.parse(candidate) as Record<string, unknown>
    return widgetFromParsedData(data)
  } catch {
    return null
  }
}

/**
 * Split a text chunk into optional prose + embedded widget JSON + prose.
 */
function expandTextSegmentForLooseWidgets(content: string): ParsedContent["segments"] {
  const trimmed = content.trim()
  if (!trimmed) return []

  const jsonStr = extractFirstJsonObject(trimmed)
  if (!jsonStr) return [{ kind: "text", content }]

  const widget = tryParseLooseWidgetJson(jsonStr)
  if (!widget) return [{ kind: "text", content }]

  const startAt = trimmed.indexOf(jsonStr)
  if (startAt === -1) return [{ kind: "text", content }]

  const before = trimmed.slice(0, startAt).trim()
  const after = trimmed.slice(startAt + jsonStr.length).trim()
  const out: ParsedContent["segments"] = []
  if (before) out.push({ kind: "text", content: before })
  out.push({ kind: "widget", widget })
  if (after) out.push({ kind: "text", content: after })
  return out
}

/**
 * Parse AI response into text and widget segments.
 * Extracts ```duwit ... ``` blocks and treats them as JSON widgets.
 * Also accepts bare JSON or ```json``` fences with a known `type` (models often omit ```duwit).
 * Non-matching content is left as text for markdown rendering.
 * Gracefully degrades: malformed JSON is treated as text.
 */
export function parseWidgets(raw: string): ParsedContent {
  const segments: ParsedContent["segments"] = []

  // Split on ```duwit blocks, preserving text between them
  const duwitRegex = /```duwit\s*([\s\S]*?)\s*```/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  // Reset regex state
  duwitRegex.lastIndex = 0

  while ((match = duwitRegex.exec(raw)) !== null) {
    // Add text before this duwit block
    if (match.index > lastIndex) {
      const textBefore = raw.slice(lastIndex, match.index).trim()
      if (textBefore) {
        segments.push({ kind: "text", content: textBefore })
      }
    }

    // Try to parse the widget
    try {
      const data = JSON.parse(match[1]) as Record<string, unknown>
      const w = widgetFromParsedData(data)
      if (!w) {
        segments.push({ kind: "text", content: match[0] })
      } else {
        segments.push({ kind: "widget", widget: w })
      }
    } catch {
      // JSON parse failed, treat entire block as text
      segments.push({ kind: "text", content: match[0] })
    }

    lastIndex = duwitRegex.lastIndex
  }

  // Add remaining text after last duwit block
  if (lastIndex < raw.length) {
    const remaining = raw.slice(lastIndex).trim()
    if (remaining) {
      segments.push({ kind: "text", content: remaining })
    }
  }

  // If no segments found, treat entire input as text
  if (segments.length === 0) {
    segments.push({ kind: "text", content: raw })
  }

  // Expand text segments: bare `{"type":"timeline",...}` or ```json``` widgets
  const expanded: ParsedContent["segments"] = []
  for (const seg of segments) {
    if (seg.kind === "widget") {
      expanded.push(seg)
      continue
    }
    const parts = expandTextSegmentForLooseWidgets(seg.content)
    expanded.push(...(parts.length > 0 ? parts : [seg]))
  }

  return { segments: expanded }
}

/**
 * Helper to check if text contains unclosed duwit blocks.
 * Used during streaming to hide incomplete widgets.
 */
export function hasUnclosedDuwitBlock(text: string): boolean {
  const openCount = (text.match(/```duwit/gi) || []).length
  const closeCount = (text.match(/```(?!duwit)/gi) || []).length
  return openCount > closeCount
}
