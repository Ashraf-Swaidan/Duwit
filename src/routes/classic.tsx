import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { LandingPage } from '@/pages/LandingPage'
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute('/classic')({
  component: ClassicLandingRoute,
})

function ClassicLandingRoute() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: '/app', replace: true })
    }
  }, [loading, user, navigate])

  if (loading) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-9 w-9 text-brand/70 animate-spin" strokeWidth={1.75} />
        <p className="text-xs font-medium text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (user) return null

  return <LandingPage />
}
