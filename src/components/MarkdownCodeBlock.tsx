import { useCallback, useState, useSyncExternalStore } from "react"
import { Check, Copy } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism"

import { cn } from "@/lib/utils"

function subscribeDarkClass(onChange: () => void) {
  const root = document.documentElement
  const obs = new MutationObserver(() => onChange())
  obs.observe(root, { attributes: true, attributeFilter: ["class"] })
  return () => obs.disconnect()
}

function useResolvedDark(): boolean {
  return useSyncExternalStore(
    subscribeDarkClass,
    () => document.documentElement.classList.contains("dark"),
    () => false
  )
}

const LANG_ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  jsx: "jsx",
  tsx: "tsx",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  html: "markup",
  vue: "markup",
  mermaid: "markdown",
}

function normalizePrismLanguage(lang: string): string {
  const raw = (lang || "").trim().toLowerCase()
  if (!raw) return ""
  return LANG_ALIASES[raw] ?? raw
}

function formatLanguageLabel(lang: string): string {
  const raw = (lang || "").trim()
  if (!raw) return "Code"
  const display = LANG_ALIASES[raw.toLowerCase()] ?? raw
  if (display.length <= 4) return display.toUpperCase()
  return display.charAt(0).toUpperCase() + display.slice(1)
}

export function MarkdownCodeBlock({
  code,
  language,
  className,
}: {
  code: string
  language: string
  className?: string
}) {
  const isDark = useResolvedDark()
  const prismLang = normalizePrismLanguage(language)
  const label = formatLanguageLabel(language)
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    const text = code.replace(/\n$/, "")
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [code])

  const theme = isDark ? oneDark : oneLight

  return (
    <div
      className={cn(
        "group/codeblock my-3 overflow-hidden rounded-xl border border-border/80 bg-muted/25 shadow-sm",
        className
      )}
    >
      <div
        className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/50 px-3 py-2"
        dir="ltr"
      >
        <span className="min-w-0 truncate font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium",
            "text-muted-foreground transition-colors",
            "hover:bg-background/80 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          )}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden />
              Copy
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={prismLang || undefined}
          style={theme}
          showLineNumbers={false}
          customStyle={{
            margin: 0,
            padding: "0.875rem 1rem",
            borderRadius: 0,
            fontSize: "0.8125rem",
            lineHeight: 1.65,
            background: "transparent",
          }}
          codeTagProps={{
            className: "font-mono [&_.token]:font-normal",
          }}
        >
          {code.replace(/\n$/, "")}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
