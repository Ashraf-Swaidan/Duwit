import { createFileRoute, useNavigate, Link, getRouteApi } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AuthForm } from '@/components/AuthForm'
import { LoginArtMotifs } from '@/components/LoginArtMotifs'
import { LoginAtmosphere } from '@/components/LoginAtmosphere'
import { LoginHeroText } from '@/components/LoginHeroText'
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
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-x-hidden bg-background">
      <header className="sticky top-0 z-30 shrink-0 border-b border-border/50 bg-background/90 backdrop-blur-md">
        <div className="mx-auto grid h-14 w-full max-w-none grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-6">
          <Link
            to="/"
            className="justify-self-start text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Home
          </Link>
          <Link
            to="/"
            className="text-center font-black text-lg tracking-tight text-foreground hover:opacity-75 transition-opacity"
          >
            Duwit
          </Link>
          <span className="justify-self-end w-14 sm:w-20" aria-hidden />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:min-h-[calc(100svh-3.5rem)] lg:flex-row">
        {/* Form column */}
        <section className="relative z-10 flex w-full flex-col justify-center border-border bg-background px-6 py-10 sm:px-10 lg:w-1/2 lg:border-r lg:py-14 lg:pl-12 lg:pr-10 xl:pl-16">
          <p className="mb-6 flex items-start gap-2 text-sm font-medium leading-relaxed text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2} aria-hidden />
            <span>
              {isSignup
                ? 'Create your account — then your goals get a path.'
                : 'Welcome back — pick up where you left off.'}
            </span>
          </p>

          <AuthForm
            layout="embedded"
            defaultMode={mode}
            onModeChange={(m) =>
              navigate({
                to: '/login',
                search: { redirect, mode: m },
                replace: true,
              })
            }
            onSuccess={() => navigate({ to: sanitizeRedirect(redirect), replace: true })}
          />

          <p className="mt-10 max-w-sm text-[11px] leading-relaxed text-muted-foreground/80">
            By continuing you agree to use Duwit responsibly. Your learning path stays private to your
            account.
          </p>
        </section>

        {/* Art / hero column */}
        <section className="relative flex min-h-[min(46vh,400px)] w-full flex-col overflow-hidden border-border bg-muted/15 lg:min-h-0 lg:w-1/2 lg:flex-1 lg:self-stretch lg:border-l dark:bg-muted/10">
          <LoginAtmosphere scope="container" />
          <LoginArtMotifs />
          <LoginHeroText />
        </section>
      </div>
    </div>
  )
}
