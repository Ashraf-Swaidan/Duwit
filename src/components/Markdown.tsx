import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"
import { parseWidgets } from "@/lib/parseWidgets"
import { WidgetRenderer } from "./WidgetRenderer"

function MarkdownText({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
}

export function Markdown({
  content,
  className,
  getChecklistInitial,
  onChecklistChange,
}: {
  content: string
  className?: string
  /** slot = nth checklist widget in this message (0-based) */
  getChecklistInitial?: (slot: number) => number[] | undefined
  onChecklistChange?: (slot: number, indices: number[]) => void
}) {
  const { segments } = parseWidgets(content)

  const rendered = useMemo(() => {
    let checklistSlot = 0
    return segments.map((seg, i) =>
      seg.kind === "text" ? (
        <MarkdownText key={i} content={seg.content} />
      ) : seg.widget.type === "checklist" ? (
        (() => {
          const slot = checklistSlot++
          return (
            <WidgetRenderer
              key={i}
              widget={seg.widget}
              checklistInitialIndices={getChecklistInitial?.(slot)}
              onChecklistChange={(indices) => onChecklistChange?.(slot, indices)}
            />
          )
        })()
      ) : (
        <WidgetRenderer key={i} widget={seg.widget} />
      ),
    )
  }, [segments, getChecklistInitial, onChecklistChange])

  return (
    <div
      className={cn(
        "space-y-3",
        // Typography tuned for chat bubbles
        "[&>p]:leading-relaxed [&>p]:text-[0.95rem]",
        "[&>ul]:ml-5 [&>ul]:list-disc [&>ul]:space-y-1 [&>ol]:ml-5 [&>ol]:list-decimal [&>ol]:space-y-1",
        "[&_li>p]:inline",
        "[&>h1]:text-lg [&>h1]:font-bold [&>h1]:tracking-tight",
        "[&>h2]:text-base [&>h2]:font-bold [&>h2]:tracking-tight",
        "[&>h3]:text-sm [&>h3]:font-semibold",
        "[&>blockquote]:border-l-2 [&>blockquote]:border-border [&>blockquote]:pl-3 [&>blockquote]:text-muted-foreground",
        "[&>hr]:border-border/60",
        "[&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-border [&_a:hover]:decoration-foreground",
        "[&_code]:rounded-md [&_code]:bg-background/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:bg-background/60 [&_pre]:p-3 [&_pre]:text-xs",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        // Table styling
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
        "[&_th]:border [&_th]:border-border/60 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:bg-muted/40",
        "[&_td]:border [&_td]:border-border/40 [&_td]:px-3 [&_td]:py-2",
        "[&_tr:hover]:bg-muted/20",
        className,
      )}
    >
      {rendered}
    </div>
  )
}

