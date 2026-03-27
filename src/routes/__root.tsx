import { createRootRoute, Outlet, useNavigate, Link, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { signOut } from "firebase/auth"
import { Settings, LogOut, Cpu, Check, X, MessageCircle, Target, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/hooks/useAuth"
import { useModel, MODEL_GROUPS, type ModelId } from "@/contexts/ModelContext"
import { useVoiceLiveModel } from "@/contexts/VoiceLiveModelContext"
import type { VoiceLiveModelChoice } from "@/config/geminiMedia"

export const Route = createRootRoute({
  component: RootComponent,
})

const VOICE_LIVE_OPTIONS: {
  id: VoiceLiveModelChoice
  name: string
  description: string
}[] = [
  {
    id: "gemini31FlashLive",
    name: "Gemini 3.1 Flash Live",
    description: "Best for voice calls — low-latency live dialogue (preview).",
  },
  {
    id: "gemini25NativeAudio",
    name: "Gemini 2.5 Native Audio",
    description: "Stable Live preview — native audio dialog.",
  },
]

function RootComponent() {
  const { user, loading: authLoading } = useAuth()
  const { selectedModel, setSelectedModel } = useModel()
  const { voiceLiveModel, setVoiceLiveModel } = useVoiceLiveModel()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const navigate = useNavigate()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  async function handleLogout() {
    try {
      await signOut(auth)
      setSettingsOpen(false)
      navigate({ to: '/', replace: true })
    } catch (e) {
      console.error("Logout failed:", e)
    }
  }

  const tabs = [
    { to: '/app', icon: MessageCircle, label: 'Home' },
    { to: '/goals', icon: Target, label: 'Goals' },
  ]

  const isTabRoute = currentPath === '/app' || currentPath === '/goals'
  const showMainChrome = !authLoading && user

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {showMainChrome && (
        <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/60 shrink-0">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
            <Link
              to="/app"
              className="font-black text-xl tracking-tight hover:opacity-60 transition-opacity shrink-0"
            >
              Duwit
            </Link>

            {isTabRoute && (
              <div className="flex flex-1 justify-center min-w-0">
                <div className="flex items-center gap-4 sm:gap-7">
                  {tabs.map(({ to, icon: Icon, label }) => {
                    const isActive = currentPath === to
                    return (
                      <button
                        key={to}
                        onClick={() => navigate({ to })}
                        className={`relative flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold transition-colors py-1 shrink-0 ${
                          isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
                        <span
                          className={`absolute -bottom-[14px] left-0 right-0 h-0.5 rounded-full transition-opacity ${
                            isActive ? 'bg-brand opacity-100' : 'opacity-0'
                          }`}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {!isTabRoute && <div className="flex-1 min-w-0" />}

            <div className="ml-auto">
              <button
                onClick={() => setSettingsOpen(true)}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 w-full min-h-0 flex flex-col">
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
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <Outlet />
          </div>
        )}
      </main>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSettingsOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[90vw] bg-background border-l border-border flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          settingsOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 h-14 border-b border-border/60 shrink-0">
          <span className="font-bold text-base">Settings</span>
          <button
            onClick={() => setSettingsOpen(false)}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">AI Model</span>
            </div>
            <div className="space-y-4">
              {MODEL_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                    {group.label}
                  </p>
                  <div className="space-y-1.5">
                    {group.models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedModel(m.id as ModelId)}
                        className={`w-full text-left rounded-2xl border p-3 transition-all duration-150 ${
                          selectedModel === m.id
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/40 hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{m.name}</span>
                          {selectedModel === m.id && (
                            <div className="shrink-0 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Voice call (Live)</span>
            </div>
            <div className="space-y-1.5">
              {VOICE_LIVE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setVoiceLiveModel(opt.id)}
                  className={`w-full text-left rounded-2xl border p-3 transition-all duration-150 ${
                    voiceLiveModel === opt.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{opt.name}</span>
                    {voiceLiveModel === opt.id && (
                      <div className="shrink-0 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

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
