import { useEffect, useRef, useState } from "react"
import { WidgetFallback } from "../WidgetRenderer"

interface MermaidData {
  code: string
}

function toMermaidData(data: Record<string, unknown>): MermaidData {
  if (typeof data.code === "string") {
    return { code: data.code }
  }
  return { code: "" }
}

export function MermaidWidget({
  data,
  title,
}: {
  data: Record<string, unknown>
  title?: string
}) {
  const mermaidData = toMermaidData(data)
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mermaidData.code) {
      setError("No diagram code provided")
      return
    }

    // Lazy load mermaid only when actually needed
    import("mermaid").then((m) => {
      try {
        const isDark = document.documentElement.classList.contains("dark")
        m.default.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "neutral",
          securityLevel: "loose",
        })

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`
        m.default
          .render(id, mermaidData.code)
          .then(({ svg }) => {
            if (ref.current) {
              ref.current.innerHTML = svg
              setError(null)
            }
          })
          .catch((e) => {
            setError(`Diagram syntax error: ${String(e).split("\n")[0]}`)
          })
      } catch (e) {
        setError(`Failed to initialize mermaid: ${String(e)}`)
      }
    })
  }, [mermaidData.code])

  if (error) {
    return <WidgetFallback raw={mermaidData.code} label={error} />
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      {title && (
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      <div
        ref={ref}
        className="flex justify-center overflow-x-auto [&_svg]:max-w-full [&_svg]:mx-auto"
      />
    </div>
  )
}
