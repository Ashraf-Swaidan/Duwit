import { Children, isValidElement, memo, useMemo, type ReactNode } from "react"
import ReactMarkdown, { defaultUrlTransform } from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Components } from "react-markdown"

import { cn } from "@/lib/utils"
import { parseWidgets } from "@/lib/parseWidgets"
import { WidgetRenderer } from "./WidgetRenderer"
import { MarkdownCodeBlock } from "./MarkdownCodeBlock"

function getTextContent(node: ReactNode): string {
  if (node == null || node === false) return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(getTextContent).join("")
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode }
    if (props.children !== undefined) return getTextContent(props.children)
  }
  return ""
}

function MarkdownPre({
  children,
  node: _node,
}: {
  children?: ReactNode
  node?: unknown
}) {
  const child = Children.toArray(children)[0]
  if (isValidElement(child)) {
    const props = child.props as { className?: string; children?: ReactNode }
    const codeText = getTextContent(props.children)
    const language =
      props.className?.match(/language-(\S+)/)?.[1]?.replace(/["']$/, "") ?? ""
    return <MarkdownCodeBlock code={codeText} language={language} />
  }
  return (
    <pre className="my-3 overflow-x-auto rounded-xl border border-border/80 bg-muted/30 p-3 text-xs leading-relaxed">
      {children}
    </pre>
  )
}

function MarkdownCode({
  className,
  children,
  node: _node,
  ...props
}: React.ComponentPropsWithoutRef<"code"> & { node?: unknown }) {
  const isFencedBlock =
    typeof className === "string" && /^language-/.test(className)
  if (isFencedBlock) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }
  return (
    <code
      className={cn(
        "rounded-md bg-muted/90 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground wrap-anywhere",
        className
      )}
      {...props}
    >
      {children}
    </code>
  )
}

const markdownComponents: Components = {
  pre: MarkdownPre,
  code: MarkdownCode,
}

function markdownUrlTransform(url: string, key: string): string {
  // Allow inline generated images saved as data URLs.
  if (
    key === "src" &&
    /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(url)
  ) {
    return url
  }
  return defaultUrlTransform(url)
}

function MarkdownText({ content }: { content: string }) {
  const normalizedContent = content
    // (data:image/...;base64,ABC...) => ![Generated image](data:image/...;base64,ABC...)
    .replace(
      /\((data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+)\)/gi,
      "![Generated image]($1)"
    )
    // bare data:image... on its own line => markdown image
    .replace(
      /(^|\n)(data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+)(?=\n|$)/gi,
      "$1![Generated image]($2)"
    )
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
      urlTransform={markdownUrlTransform}
    >
      {normalizedContent}
    </ReactMarkdown>
  )
}

export const Markdown = memo(function Markdown({
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
        "[&_img]:my-2 [&_img]:max-h-112 [&_img]:w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-border/60 [&_img]:object-contain",
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
})

