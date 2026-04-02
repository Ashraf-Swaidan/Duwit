import { useState, useEffect } from "react"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc } from "firebase/firestore"
import { USER_PROFILE_VERSION } from "@/services/user"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AuthMode = "login" | "signup"

interface AuthFormProps {
  onSuccess?: () => void
  /** Sync URL or parent state when switching sign-in vs sign-up (e.g. `?mode=`). */
  onModeChange?: (mode: AuthMode) => void
  /**
   * `page` — full-viewport centered with wordmark (standalone auth screen).
   * `split` — width-constrained block, no wordmark (legacy / side panels).
   * `embedded` — flat panel; parent page supplies layout (e.g. split column).
   */
  layout?: "page" | "split" | "embedded"
  /** Initial tab when mounting (e.g. from `/login?mode=signup`). */
  defaultMode?: AuthMode
}

export function AuthForm({
  onSuccess,
  onModeChange,
  layout = "page",
  defaultMode = "login",
}: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode)

  useEffect(() => {
    setMode(defaultMode)
  }, [defaultMode])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === "signup") {
        const userCred = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(userCred.user, { displayName })
        await setDoc(doc(db, "users", userCred.user.uid), {
          email,
          displayName,
          createdAt: new Date().toISOString(),
          profile: {
            nickname: displayName || email.split("@")[0],
            profileVersion: USER_PROFILE_VERSION,
          },
        })
        onSuccess?.()
      } else {
        await signInWithEmailAndPassword(auth, email, password)
        onSuccess?.()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const split = layout === "split"
  const embedded = layout === "embedded"
  const showWordmark = layout === "page"

  const embeddedFieldClass =
    "w-full h-11 rounded-lg border border-input bg-background px-3.5 text-sm transition-[color,box-shadow,border-color] placeholder:text-muted-foreground/65 focus-visible:outline-none focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/20 dark:bg-background/80"
  const defaultFieldClass =
    "w-full rounded-xl border bg-transparent px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"

  return (
    <div
      className={cn(
        embedded && "w-full",
        split && "w-full max-w-md mx-auto px-4 py-10 lg:py-16 bg-background",
        showWordmark && "min-h-svh flex flex-col items-center justify-center px-5 bg-background",
      )}
    >
      <div
        className={cn(
          "w-full space-y-8",
          showWordmark && "max-w-sm",
          embedded && "max-w-md",
        )}
      >
        {showWordmark && (
          <div className="text-center space-y-1">
            <h1 className="text-5xl font-black tracking-tight">Duwit</h1>
            <p className="text-muted-foreground text-sm">Turn goals into done.</p>
          </div>
        )}

        {/* Form panel */}
        <div
          className={cn(
            "space-y-5 transition-shadow",
            embedded ? "rounded-none border-0 bg-transparent p-0 shadow-none" : "rounded-3xl border bg-card border-border/80 p-7 shadow-sm",
          )}
        >
          {embedded ? (
            <div role="tablist" aria-label="Account" className="flex gap-10 border-b border-border">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => {
                  setMode("login")
                  setError(null)
                  onModeChange?.("login")
                }}
                className={cn(
                  "-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors",
                  mode === "login"
                    ? "border-brand text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                onClick={() => {
                  setMode("signup")
                  setError(null)
                  onModeChange?.("signup")
                }}
                className={cn(
                  "-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors",
                  mode === "signup"
                    ? "border-brand text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Sign up
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <h2 className="font-bold text-lg">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === "login"
                  ? "Sign in to continue where you left off."
                  : "Set up your account in seconds."}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Your name</label>
                <input
                  type="text"
                  className={embedded ? embeddedFieldClass : defaultFieldClass}
                  placeholder="Alex Smith"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required={mode === "signup"}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                className={embedded ? embeddedFieldClass : defaultFieldClass}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                className={embedded ? embeddedFieldClass : defaultFieldClass}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full text-sm font-semibold",
                embedded ? "h-11 rounded-lg" : "h-11 rounded-xl",
              )}
            >
              {loading
                ? mode === "login"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </Button>
          </form>

          {!embedded && (
            <div className="text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  No account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("signup"); setError(null) }}
                    className="font-semibold text-foreground hover:underline underline-offset-4"
                  >
                    Sign up free
                  </button>
                </>
              ) : (
                <>
                  Already have one?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setError(null) }}
                    className="font-semibold text-foreground hover:underline underline-offset-4"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
