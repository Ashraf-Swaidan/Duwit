import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { Minus, Square, SquareDashed, X } from "lucide-react"

function isElectronEnvironment() {
  return typeof window !== "undefined" && typeof window.electron !== "undefined"
}

export function DesktopTitleBar() {
  const isElectron = useMemo(isElectronEnvironment, [])
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!isElectron) return

    let mounted = true
    window.electron.windowControls.isMaximized().then((maximized) => {
      if (mounted) setIsMaximized(maximized)
    })

    const sync = () => {
      window.electron.windowControls
        .isMaximized()
        .then((maximized) => {
          setIsMaximized(maximized)
        })
        .catch(() => {
          // Keep title bar responsive even if IPC fails once.
        })
    }

    window.addEventListener("resize", sync)
    return () => {
      mounted = false
      window.removeEventListener("resize", sync)
    }
  }, [isElectron])

  if (!isElectron) return null

  return (
    <div
      className="h-10 shrink-0 border-b border-border/60 bg-background/90 backdrop-blur-md flex items-center justify-between pl-3 pr-0"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      <div className="flex items-center gap-2 select-none">
        <div className="h-6 w-6 rounded-md bg-brand text-brand-foreground grid place-items-center font-black text-sm">
          D
        </div>
        <span className="text-xs font-semibold tracking-wide text-foreground/90">Duwit</span>
      </div>

      <div className="flex items-stretch h-full" style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
        <button
          type="button"
          aria-label="Minimize window"
          className="w-12 h-full grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={() => void window.electron.windowControls.minimize()}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
          className="w-12 h-full grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={async () => {
            const maximized = await window.electron.windowControls.toggleMaximize()
            setIsMaximized(maximized)
          }}
        >
          {isMaximized ? <SquareDashed className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          aria-label="Close window"
          className="w-12 h-full grid place-items-center text-muted-foreground hover:bg-destructive hover:text-white transition-colors"
          onClick={() => void window.electron.windowControls.close()}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
