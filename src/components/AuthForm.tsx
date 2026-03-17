import { useState } from "react"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"

type AuthMode = "login" | "signup"

interface AuthFormProps {
  onSuccess?: () => void
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("login")
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

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-5 bg-background">
      <div className="w-full max-w-sm space-y-8">
        {/* Wordmark */}
        <div className="text-center space-y-1">
          <h1 className="text-5xl font-black tracking-tight">Duwit</h1>
          <p className="text-muted-foreground text-sm">Turn goals into done.</p>
        </div>

        {/* Form card */}
        <div className="bg-card rounded-3xl border p-7 shadow-sm space-y-5">
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
