import { useState, useEffect } from "react"
import { Check } from "lucide-react"

interface ChecklistData {
  items?: string[]
}

export function ChecklistWidget({
  data,
  title,
  initialCheckedIndices,
  onCheckedChange,
}: {
  data: Record<string, unknown>
  title?: string
  /** Restored from Firestore */
  initialCheckedIndices?: number[]
  /** Fired when user toggles; use to persist selections */
  onCheckedChange?: (checkedIndices: number[]) => void
}) {
  const checklistData = data as ChecklistData
  const items = checklistData.items || []
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(initialCheckedIndices ?? []),
  )

  const initialSig = (initialCheckedIndices ?? []).join(",")
  useEffect(() => {
    setChecked(new Set(initialCheckedIndices ?? []))
  }, [initialSig])

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">No checklist items</p>
      </div>
    )
  }

  const toggleItem = (idx: number) => {
    const newChecked = new Set(checked)
    if (newChecked.has(idx)) {
      newChecked.delete(idx)
    } else {
      newChecked.add(idx)
    }
    setChecked(newChecked)
    onCheckedChange?.([...newChecked].sort((a, b) => a - b))
  }

  const allChecked = checked.size === items.length

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      {title && (
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => toggleItem(idx)}
            className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              checked.has(idx)
                ? "border-brand/60 bg-brand/5"
                : "border-border/40 hover:bg-muted/30"
            }`}
          >
            <div
              className={`mt-0.5 h-5 w-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                checked.has(idx)
                  ? "border-brand bg-brand"
                  : "border-border"
              }`}
            >
              {checked.has(idx) && <Check className="h-3 w-3 text-background" />}
            </div>
            <span
              className={`text-sm leading-relaxed ${
                checked.has(idx) ? "line-through text-muted-foreground" : ""
              }`}
            >
              {item}
            </span>
          </button>
        ))}
      </div>

      {allChecked && (
        <div className="rounded-lg bg-green-500/10 px-4 py-3 text-center text-sm font-medium text-green-700 dark:text-green-400">
          ✓ All items completed!
        </div>
      )}
    </div>
  )
}
