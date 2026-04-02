import { createFileRoute, useNavigate, Link, getRouteApi } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AuthForm } from '@/components/AuthForm'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, Sparkles } from 'lucide-react'

type AuthMode = 'login' | 'signup'

export const Route = createFileRoute('/login')({
  validateSearch: (raw: Record<string, unknown>) => {
    const redirect =
      typeof raw.redirect === 'string' && raw.redirect.startsWith('/') && !raw.redirect.startsWith('//')
        ? raw.redirect
        : undefined
    const mode: AuthMode = raw.mode === 'signup' ? 'signup' : 'login'
    return { redirect, mode }
  },
  component: LoginPage,
})

const loginRouteApi = getRouteApi('/login')

function sanitizeRedirect(r: string | undefined): string {
  if (!r || !r.startsWith('/') || r.startsWith('//')) return '/app'
  if (r === '/login') return '/app'
  return r
}

function LoginPage() {
  const { redirect, mode } = loginRouteApi.useSearch()
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: sanitizeRedirect(redirect), replace: true })
    }
  }, [loading, user, navigate, redirect])

  if (loading) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-9 w-9 text-brand/70 animate-spin" strokeWidth={1.75} />
      </div>
    )
  }

  if (user) return null

  const isSignup = mode === 'signup'

  return (
    <div className="relative min-h-svh flex flex-col overflow-hidden bg-background">
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-15%,oklch(0.72_0.16_55/0.2),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,oklch(0.93_0.06_70/0.5),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] bg-[radial-gradient(circle_at_15%_40%,oklch(0.72_0.12_55/0.12),transparent_45%)]"
        aria-hidden
      />

      <header className="relative z-10 shrink-0 border-b border-border/50 bg-background/70 backdrop-blur-md">
        <div className="mx-auto grid h-14 max-w-2xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4">
          <Link
            to="/"
            className="justify-self-start text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Home
          </Link>
          <Link
            to="/"
            className="font-black text-lg tracking-tight text-foreground hover:opacity-75 transition-opacity text-center"
          >
            Duwit
          </Link>
          <span className="justify-self-end w-14 sm:w-20" aria-hidden />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="w-full max-w-md flex flex-col items-center">
          <div className="mb-8 flex flex-col items-center text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12 text-brand ring-1 ring-brand/25 shadow-sm">
              <Sparkles className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div className="space-y-2 max-w-sm">
              <h1
                className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight text-foreground leading-tight"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
              >
                {isSignup ? "Start your next chapter" : "Good to see you again"}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isSignup
                  ? "Create an account and Duwit will help you turn goals into a path—tasks, guidance, and quiet wins."
                  : "Sign in to open your home chat, goals, and every plan you’ve already shaped."}
              </p>
            </div>
          </div>

          <div className="w-full flex justify-center">
            <AuthForm
              layout="embedded"
              defaultMode={mode}
              onSuccess={() => navigate({ to: sanitizeRedirect(redirect), replace: true })}
            />
          </div>

          <p className="mt-10 text-center text-[11px] text-muted-foreground/80 max-w-xs leading-relaxed">
            By continuing you agree to use Duwit responsibly. Your learning path stays private to your account.
          </p>
        </div>
      </main>
    </div>
  )
}
