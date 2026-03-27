/**
 * Models often emit comparison/table rows with keys that don't exactly match
 * `columns[]` (short keys vs long headers). Resolve the best cell value.
 */
function hasContent(v: unknown): boolean {
  return v != null && String(v).trim() !== ""
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

export function resolveKeyedCell(
  row: Record<string, unknown>,
  columnKey: string,
  columnIndex: number,
  allColumnKeys: string[],
): string {
  if (hasContent(row[columnKey])) return String(row[columnKey])

  // Case-insensitive key match
  for (const k of Object.keys(row)) {
    if (k === "label") continue
    if (k.toLowerCase() === columnKey.toLowerCase() && hasContent(row[k])) {
      return String(row[k])
    }
  }

  // Normalized key match (handles "Ancient Trade" vs "ancienttrade")
  const nCol = normKey(columnKey)
  if (nCol.length > 0) {
    for (const k of Object.keys(row)) {
      if (k === "label") continue
      if (normKey(k) === nCol && hasContent(row[k])) return String(row[k])
    }
  }

  // Substring match when both are long enough (headers vs abbreviated keys)
  const cLow = columnKey.toLowerCase()
  for (const k of Object.keys(row)) {
    if (k === "label" || !hasContent(row[k])) continue
    const kLow = k.toLowerCase()
    if (k.length >= 4 && cLow.length >= 4 && (cLow.includes(kLow) || kLow.includes(cLow))) {
      return String(row[k])
    }
  }

  // Positional fallback: same number of value keys as columns (common model slip-up)
  const dataKeys = Object.keys(row).filter((k) => k !== "label")
  if (dataKeys.length === allColumnKeys.length && columnIndex < dataKeys.length) {
    const k = dataKeys[columnIndex]
    if (hasContent(row[k])) return String(row[k])
  }

  return String(row[columnKey] ?? "")
}
