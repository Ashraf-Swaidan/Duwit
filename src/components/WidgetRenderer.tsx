import { useMemo } from "react"
import type { Widget } from "@/lib/parseWidgets"
import { ChartWidget } from "./widgets/ChartWidget"
import { TableWidget } from "./widgets/TableWidget"
import { MermaidWidget } from "./widgets/MermaidWidget"
import { FlashcardsWidget } from "./widgets/FlashcardsWidget"
import { ComparisonWidget } from "./widgets/ComparisonWidget"
import { TimelineWidget } from "./widgets/TimelineWidget"
import { CodeWidget } from "./widgets/CodeWidget"
import { ChecklistWidget } from "./widgets/ChecklistWidget"
import { YoutubeWidget } from "./widgets/YoutubeWidget"

interface WidgetRendererProps {
  widget: Widget
  checklistInitialIndices?: number[]
  onChecklistChange?: (indices: number[]) => void
}

/**
 * Main dispatcher component for rendering different widget types.
 * If a widget fails to render, falls back to showing the raw JSON
 * so the session never breaks.
 */
export function WidgetRenderer({
  widget,
  checklistInitialIndices,
  onChecklistChange,
}: WidgetRendererProps) {
  // Memoize to avoid re-rendering on parent updates
  const content = useMemo(() => {
    try {
      switch (widget.type) {
        case "chart":
          return <ChartWidget data={widget.data} title={widget.title} />
        case "table":
          return <TableWidget data={widget.data} title={widget.title} />
        case "mermaid":
          return <MermaidWidget data={widget.data} title={widget.title} />
        case "flashcards":
          return <FlashcardsWidget data={widget.data} title={widget.title} />
        case "comparison":
          return <ComparisonWidget data={widget.data} title={widget.title} />
        case "timeline":
          return <TimelineWidget data={widget.data} title={widget.title} />
        case "code":
          return <CodeWidget data={widget.data} title={widget.title} />
        case "checklist":
          return (
            <ChecklistWidget
              data={widget.data}
              title={widget.title}
              initialCheckedIndices={checklistInitialIndices}
              onCheckedChange={onChecklistChange}
            />
          )
        case "youtube":
          return <YoutubeWidget data={widget.data} title={widget.title} />
        default:
          return <WidgetFallback raw={JSON.stringify(widget.data, null, 2)} />
      }
    } catch (error) {
      // Graceful error handling
      console.error(`Error rendering widget type ${widget.type}:`, error)
      return (
        <WidgetFallback
          raw={JSON.stringify(widget.data, null, 2)}
          label={`Error rendering ${widget.type} widget`}
        />
      )
    }
  }, [widget, checklistInitialIndices, onChecklistChange])

  return content
}

/**
 * Fallback rendering for widget errors or unknown types.
 * Displays the raw JSON so users can at least see the data.
 */
export function WidgetFallback({
  raw,
  label = "Widget data",
}: {
  raw: string
  label?: string
}) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
      <p className="mb-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
        {label}
      </p>
      <pre className="overflow-x-auto rounded bg-background/60 p-3 text-xs">
        <code>{raw}</code>
      </pre>
    </div>
  )
}
