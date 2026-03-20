import { useState } from "react"
import { Copy, Check } from "lucide-react"

interface CodeData {
  code?: string
  language?: string
}

export function CodeWidget({
  data,
  title,
}: {
  data: Record<string, unknown>
  title?: string
}) {
  const codeData = data as CodeData
  const code = (codeData.code as string) || ""
  const language = (codeData.language as string) || "plaintext"
  const [copied, setCopied] = useState(false)

  if (!code) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">No code</p>
      </div>
    )
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
      {title && (
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}

      <div className="relative overflow-hidden rounded-lg border bg-background">
        <div className="flex items-center justify-between border-b border-border/40 bg-muted/40 px-4 py-2">
          <span className="text-xs font-mono text-muted-foreground">{language}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-muted"
            aria-label="Copy code"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>

        <pre className="overflow-x-auto p-4 text-xs">
          <code className="font-mono">{code}</code>
        </pre>
      </div>
    </div>
  )
}
