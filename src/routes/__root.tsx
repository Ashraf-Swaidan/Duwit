import { createRootRoute, Outlet, useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { signOut } from "firebase/auth"
import { Settings, Plus, LogOut, Cpu, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthForm } from "@/components/AuthForm"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/hooks/useAuth"
import { useModel, AVAILABLE_MODELS, type ModelId } from "@/contexts/ModelContext"

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const { user, loading: authLoading } = useAuth()
  const { selectedModel, setSelectedModel } = useModel()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await signOut(auth)
      setSettingsOpen(false)
    } catch (e) {
      console.error("Logout failed:", e)
    }
  }

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="font-black text-xl tracking-tight hover:opacity-60 transition-opacity"
          >
            Duwit
          </Link>

          {user && !authLoading && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate({ to: '/new-goal' })}
                className="gap-1.5 rounded-full h-8 px-3 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                New Goal
              </Button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 w-full min-h-0">
        {authLoading ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-6 animate-in zoom-in-95 fade-in duration-500">
            <div className="flex flex-col items-center">
              <h1 className="text-5xl font-black tracking-tighter">
                Duwit<span className="text-brand inline-block animate-pulse">.</span>
              </h1>
              <p className="text-sm text-muted-foreground/60 mt-2 font-medium tracking-wide uppercase">
                Preparing workspace
              </p>
            </div>
            <div className="flex gap-1.5 mt-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand/60 animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-brand/60 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-brand/60 animate-bounce" />
            </div>
          </div>
        ) : !user ? (
          <AuthForm />
        ) : (
          <Outlet />
        )}
      </main>

      {/* Settings drawer — backdrop */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSettingsOpen(false)}
        />
      )}

      {/* Settings drawer — panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[90vw] bg-background border-l border-border flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          settingsOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-border/60 shrink-0">
          <span className="font-bold text-base">Settings</span>
          <button
            onClick={() => setSettingsOpen(false)}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
          {/* Model picker */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">AI Model</span>
            </div>
            <div className="space-y-2">
              {AVAILABLE_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id as ModelId)}
                  className={`w-full text-left rounded-2xl border p-3.5 transition-all duration-150 ${
                    selectedModel === m.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{m.name}</span>
                    {selectedModel === m.id && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Account section */}
          <div className="space-y-3 pt-2 border-t">
            <div className="pt-3">
              <p className="text-xs text-muted-foreground mb-0.5">Signed in as</p>
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full gap-2 rounded-xl"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
