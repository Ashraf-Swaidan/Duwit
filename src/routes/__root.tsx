import { createRootRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { signOut } from "firebase/auth"
import {
  Settings,
  LogOut,
  Cpu,
  Check,
  X,
  MessageCircle,
  Target,
  Mic,
  ChevronDown,
  Sparkles,
  SlidersHorizontal,
  MoreVertical,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/hooks/useAuth"
import { useModel, MODEL_GROUPS, IMAGE_MODELS, type ImageModelId, type ModelId } from "@/contexts/ModelContext"
import { useVoiceLiveModel } from "@/contexts/VoiceLiveModelContext"
import { ProfileDialogProvider, useProfileDialog } from "@/contexts/ProfileDialogContext"
import { DesktopTitleBar } from "@/components/DesktopTitleBar"
import type { VoiceLiveModelChoice } from "@/config/geminiMedia"
import { cn } from "@/lib/utils"

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

function SettingsDrawerPanel({
  settingsOpen,
  setSettingsOpen,
}: {
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
}) {
  const { user } = useAuth()
  const { openPreferencesEditor } = useProfileDialog()
  const {
    selectedModel,
    setSelectedModel,
    selectedSearchModel,
    setSelectedSearchModel,
    selectedImageModel,
    setSelectedImageModel,
  } = useModel()
  const { voiceLiveModel, setVoiceLiveModel } = useVoiceLiveModel()
  const navigate = useNavigate()

  const [aiOpen, setAiOpen] = useState(true)
  const [aiSection, setAiSection] = useState<"text" | "voice">("text")
  const [geminiTextOpen, setGeminiTextOpen] = useState(false)
  const [geminiSearchOpen, setGeminiSearchOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(true)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!profileMenuRef.current?.contains(e.target as Node)) setProfileMenuOpen(false)
    }
    if (profileMenuOpen) document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [profileMenuOpen])

  async function handleLogout() {
    try {
      await signOut(auth)
      setSettingsOpen(false)
      navigate({ to: "/", replace: true })
    } catch (e) {
      console.error("Logout failed:", e)
    }
  }

  const displayName = user?.displayName?.trim() || user?.email?.split("@")[0] || "User"
  const email = user?.email ?? ""
  const initial = (displayName[0] || email[0] || "?").toUpperCase()
  const geminiModels = MODEL_GROUPS.find((g) => g.label === "Gemini")?.models ?? []
  const gemmaModel = MODEL_GROUPS.find((g) => g.label === "Gemma")?.models[0]
  const selectedTextModelMeta = MODEL_GROUPS.flatMap((g) => g.models).find((m) => m.id === selectedModel)
  const selectedSearchModelMeta =
    selectedSearchModel === null
      ? null
      : MODEL_GROUPS.flatMap((g) => g.models).find((m) => m.id === selectedSearchModel)
  const selectedImageModelMeta = IMAGE_MODELS.find((m) => m.id === selectedImageModel)

  return (
    <div
      className={`fixed top-0 right-0 bottom-0 z-50 w-full sm:w-104 max-w-full bg-background border-l border-border flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
        settingsOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-border/60 shrink-0">
        <span className="font-bold text-base">Settings</span>
        <button
          type="button"
          onClick={() => setSettingsOpen(false)}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5 min-h-0">
        {/* AI — collapsible */}
        <div className="rounded-2xl border border-border/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setAiOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-brand shrink-0" />
              AI
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", aiOpen && "rotate-180")} />
          </button>
          {aiOpen && (
            <div className="px-3 pb-3 pt-3 space-y-3 border-t border-border/50">
              <div className="rounded-xl bg-muted/40 p-1 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setAiSection("text")}
                  className={cn(
                    "h-9 rounded-lg text-xs font-semibold transition-colors",
                    aiSection === "text"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" />
                    Text chat
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiSection("voice")}
                  className={cn(
                    "h-9 rounded-lg text-xs font-semibold transition-colors",
                    aiSection === "voice"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5" />
                    Voice call
                  </span>
                </button>
              </div>

              {aiSection === "text" && (
                <div className="rounded-xl border border-border/60 bg-background/50 px-2 pb-3 pt-2 space-y-3">
                  <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Text model powers normal replies. Search model is used only when web-grounded responses are requested.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                      Text responses
                    </p>
                    <div className="rounded-xl border border-border/60 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setGeminiTextOpen((o) => !o)}
                        className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-sm font-semibold">Gemini</span>
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground truncate max-w-36 sm:max-w-48">
                            {selectedModel.startsWith("gemini")
                              ? (selectedTextModelMeta?.name ?? "Select series")
                              : "Select series"}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0",
                              geminiTextOpen && "rotate-180",
                            )}
                          />
                        </span>
                      </button>
                      {geminiTextOpen && (
                        <div className="border-t border-border/50 bg-muted/10 py-1">
                          {geminiModels.map((m) => (
                            <button
                              key={`text-gemini-${m.id}`}
                              type="button"
                              onClick={() => setSelectedModel(m.id as ModelId)}
                              className="w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-sm">{m.name.replace(/^Gemini\s*/i, "")}</span>
                                {selectedModel === m.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {gemmaModel && (
                      <button
                        type="button"
                        onClick={() => setSelectedModel(gemmaModel.id as ModelId)}
                        className="w-full rounded-xl border border-border/60 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">Gemma</span>
                          {selectedModel === gemmaModel.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">Gemma 3 27B (default)</p>
                      </button>
                    )}
                  </div>

                  <div className="pt-1 border-t border-border/40" />

                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                      Image generation
                    </p>
                    <div className="rounded-xl border border-border/60 overflow-hidden">
                      <div className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left bg-muted/20">
                        <span className="text-sm font-semibold">Image model</span>
                        <span className="text-xs text-muted-foreground truncate max-w-36 sm:max-w-48">
                          {selectedImageModelMeta?.name ?? "Select model"}
                        </span>
                      </div>
                      <div className="border-t border-border/50 bg-muted/10 py-1">
                        {IMAGE_MODELS.map((m) => (
                          <button
                            key={`image-${m.id}`}
                            type="button"
                            onClick={() => setSelectedImageModel(m.id as ImageModelId)}
                            className="w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm">{m.name.replace(/^Imagen\s*/i, "")}</span>
                              {selectedImageModel === m.id && (
                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground px-1 leading-relaxed">
                      Use in chat with <code>/image your prompt</code>.
                    </p>
                  </div>

                  <div className="pt-1 border-t border-border/40" />

                  <div className="space-y-1.5">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                        Web search requests
                      </p>
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedSearchModel(null)}
                          className={`w-full text-left rounded-xl border border-border/60 px-3 py-2.5 transition-all duration-150 ${
                            selectedSearchModel === null
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold">Same as text model</span>
                            {selectedSearchModel === null && (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Uses your selected text model for search-enabled replies.
                          </p>
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/60 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setGeminiSearchOpen((o) => !o)}
                        className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-sm font-semibold">Gemini (search)</span>
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground truncate max-w-32 sm:max-w-44">
                            {selectedSearchModel?.startsWith("gemini")
                              ? (selectedSearchModelMeta?.name ?? "Select series")
                              : "Select series"}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0",
                              geminiSearchOpen && "rotate-180",
                            )}
                          />
                        </span>
                      </button>
                      {geminiSearchOpen && (
                        <div className="border-t border-border/50 bg-muted/10 py-1">
                          {geminiModels.map((m) => (
                            <button
                              key={`search-gemini-${m.id}`}
                              type="button"
                              onClick={() => setSelectedSearchModel(m.id as ModelId)}
                              className="w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-sm">{m.name.replace(/^Gemini\s*/i, "")}</span>
                                {selectedSearchModel === m.id && (
                                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {gemmaModel && (
                      <button
                        type="button"
                        onClick={() => setSelectedSearchModel(gemmaModel.id as ModelId)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          selectedSearchModel === gemmaModel.id
                            ? "border-primary bg-primary/5"
                            : "border-border/60 hover:bg-muted/40"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">Gemma (search)</span>
                          {selectedSearchModel === gemmaModel.id && (
                            <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">Gemma 3 27B</p>
                      </button>
                    )}

                    <div className="pt-1 border-t border-border/40">
                      <p className="text-[10px] text-muted-foreground px-1 leading-relaxed">
                        Text/chat model stays independent. This selector is used for web-grounded task-chat responses.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {aiSection === "voice" && (
                <div className="rounded-xl border border-border/60 bg-background/50 px-2 pb-3 pt-2 space-y-2">
                  <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Voice call model only affects real-time microphone conversations.
                    </p>
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
              )}
            </div>
          )}
        </div>

        {/* Preferences */}
        <div className="rounded-2xl border border-border/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setPrefsOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
              Preferences
            </span>
            <ChevronDown
              className={cn("h-4 w-4 text-muted-foreground transition-transform", prefsOpen && "rotate-180")}
            />
          </button>
          {prefsOpen && (
            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Learning style, pace, tone, and accessibility — used across every chat to personalize coaching.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="w-full rounded-xl gap-2"
                onClick={() => {
                  openPreferencesEditor()
                  setSettingsOpen(false)
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit preferences
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Profile card */}
      <div className="shrink-0 border-t border-border/60 p-4 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-brand/15 text-brand flex items-center justify-center text-sm font-bold shrink-0 ring-2 ring-background">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
          <div className="relative shrink-0" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((o) => !o)}
              className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
              aria-label="Account menu"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            {profileMenuOpen && (
              <div className="absolute bottom-full right-0 mb-1 w-48 rounded-xl border border-border bg-popover shadow-lg py-1 z-60">
                <button
                  type="button"
                  disabled
                  className="w-full px-3 py-2 text-left text-sm text-muted-foreground cursor-not-allowed opacity-60 flex items-center gap-2"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    void handleLogout()
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RootLayout() {
  const { user, loading: authLoading } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const navigate = useNavigate()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const tabs = [
    { to: "/app", icon: MessageCircle, label: "Home" },
    { to: "/goals", icon: Target, label: "Goals" },
  ]

  const isTabRoute = currentPath === "/app" || currentPath === "/goals"
  const showMainChrome = !authLoading && user

  return (
    <div className="min-h-svh bg-background flex flex-col">
      <DesktopTitleBar />
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
                        type="button"
                        onClick={() => navigate({ to })}
                        className={`relative flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold transition-colors py-1 shrink-0 ${
                          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
                        <span
                          className={`absolute -bottom-[14px] left-0 right-0 h-0.5 rounded-full transition-opacity ${
                            isActive ? "bg-brand opacity-100" : "opacity-0"
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
                type="button"
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

      <SettingsDrawerPanel settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} />
    </div>
  )
}

function RootComponent() {
  return (
    <ProfileDialogProvider>
      <RootLayout />
    </ProfileDialogProvider>
  )
}
