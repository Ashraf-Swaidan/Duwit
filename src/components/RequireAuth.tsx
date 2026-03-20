import { useEffect } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (loading || user) return
    navigate({
      to: "/login",
      search: { redirect: pathname },
      replace: true,
    })
  }, [loading, user, navigate, pathname])

  if (loading) {
    return (
      <div className="flex flex-1 min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-9 w-9 text-brand/70 animate-spin" strokeWidth={1.75} />
        <p className="text-xs font-medium text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-1 min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-brand/50 animate-spin" strokeWidth={1.75} />
      </div>
    )
  }

  return <>{children}</>
}
