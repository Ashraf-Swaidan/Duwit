import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

export function Markdown({
  content,
  className,
}: {
  content: string
  className?: string
}) {
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
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

