import { useState, useEffect } from "react"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AuthMode = "login" | "signup"

interface AuthFormProps {
  onSuccess?: () => void
  /**
   * `page` — full-viewport centered with wordmark (standalone auth screen).
   * `split` — width-constrained block, no wordmark (legacy / side panels).
   * `embedded` — card only; parent page supplies chrome and headline.
   */
  layout?: "page" | "split" | "embedded"
  /** Initial tab when mounting (e.g. from `/login?mode=signup`). */
  defaultMode?: AuthMode
}

export function AuthForm({ onSuccess, layout = "page", defaultMode = "login" }: AuthFormProps) {
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

  return (
    <div
      className={cn(
        embedded && "w-full",
        split && "w-full max-w-md mx-auto px-4 py-10 lg:py-16 bg-background",
        showWordmark && "min-h-svh flex flex-col items-center justify-center px-5 bg-background",
      )}
    >
      <div className={cn("w-full space-y-8", showWordmark && "max-w-sm", embedded && "max-w-[420px] mx-auto")}>
        {showWordmark && (
          <div className="text-center space-y-1">
            <h1 className="text-5xl font-black tracking-tight">Duwit</h1>
            <p className="text-muted-foreground text-sm">Turn goals into done.</p>
          </div>
        )}

        {/* Form card */}
        <div
          className={cn(
            "rounded-3xl border p-7 space-y-5 transition-shadow",
            embedded
              ? "bg-card/95 border-border/80 shadow-lg shadow-brand/5 ring-1 ring-brand/10 backdrop-blur-sm"
              : "bg-card border-border/80 shadow-sm",
          )}
        >
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Your name</label>
                <input
                  type="text"
                  className="w-full rounded-xl border bg-transparent px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
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
                className="w-full rounded-xl border bg-transparent px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
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
                className="w-full rounded-xl border bg-transparent px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
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
              className="w-full h-11 rounded-xl text-sm font-semibold"
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

          <div className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                No account?{" "}
                <button
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
                  onClick={() => { setMode("login"); setError(null) }}
                  className="font-semibold text-foreground hover:underline underline-offset-4"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
