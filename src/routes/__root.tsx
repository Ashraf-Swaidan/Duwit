import { createRootRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { signOut } from "firebase/auth"
import { useQuery } from "@tanstack/react-query"
import {
  Check,
  Settings,
  LogOut,
  Home,
  Plus,
  X,
  Target,
  ChevronDown,
  Sparkles,
  SlidersHorizontal,
  MoreVertical,
  Pencil,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { auth } from "@/lib/firebase"
import { getUserGoals } from "@/services/goals"
import { useAuth } from "@/hooks/useAuth"
import { useModel, AVAILABLE_MODELS, IMAGE_MODELS, type ImageModelId, type ModelId } from "@/contexts/ModelContext"
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

const MOBILE_SWIPE_HINT_KEY = "duwit_mobile_swipe_nav_hint_seen_v2"
/** v1 legacy — bump so users who "finished" while the tour was disabled get one fresh pass */
const ONBOARDING_DONE_KEY = "duwit_focus_onboarding_done_v2"

function isMobileViewport() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(max-width: 639px)").matches
}

type OnboardingStep = {
  id: string
  routePrefix: string
  targetId?: string
  fallbackTargetId?: string
  title: string
  body: string
  actionLabel?: string
  actionTo?: string
  waitForTarget?: boolean
}

function routeMatches(prefix: string, path: string) {
  return prefix === path || path.startsWith(prefix)
}

/** First tour step index that matches the current URL so the tour can catch up if the user navigated ahead. */
function getMinStepIndexForPath(pathname: string): number {
  if (pathname.startsWith("/plan/")) return 4
  if (pathname === "/new-goal") return 2
  if (pathname === "/app" || pathname === "/goals") return 0
  return 0
}

function getScreenLabel(pathname: string): string {
  if (pathname.startsWith("/plan/")) return "your plan"
  if (pathname === "/new-goal") return "New goal"
  if (pathname === "/goals") return "Goals"
  if (pathname === "/app") return "Home"
  return "this screen"
}

function renderWrongRouteHint(step: OnboardingStep, currentPath: string): ReactNode {
  const here = getScreenLabel(currentPath)
  if (step.routePrefix === "/app") {
    if (currentPath.startsWith("/plan/")) {
      return (
        <>
          You&apos;re viewing <strong className="text-amber-200/95">your plan</strong>. For this step, open{" "}
          <strong className="text-amber-200/95">Home</strong> from the side rail.
        </>
      )
    }
    if (currentPath === "/new-goal") {
      return (
        <>
          You&apos;re in <strong className="text-amber-200/95">New goal</strong>. This step is on{" "}
          <strong className="text-amber-200/95">Home</strong> — switch there to continue.
        </>
      )
    }
    if (currentPath === "/goals") {
      return (
        <>
          You&apos;re on <strong className="text-amber-200/95">Goals</strong>. Open{" "}
          <strong className="text-amber-200/95">Home</strong> to continue this step.
        </>
      )
    }
    return (
      <>
        You&apos;re on {here}. Open <strong className="text-amber-200/95">Home</strong> to continue this step.
      </>
    )
  }
  if (step.routePrefix === "/new-goal") {
    if (currentPath === "/app" || currentPath === "/goals") {
      return (
        <>
          You&apos;re on <strong className="text-amber-200/95">{here}</strong>. Tap{" "}
          <strong className="text-amber-200/95">New</strong> in the rail to open the goal builder.
        </>
      )
    }
    if (currentPath.startsWith("/plan/")) {
      return (
        <>
          You&apos;re on <strong className="text-amber-200/95">your plan</strong>. Use{" "}
          <strong className="text-amber-200/95">New</strong> or return to <strong className="text-amber-200/95">Home</strong> when
          you&apos;re ready to follow this step.
        </>
      )
    }
    return (
      <>
        You&apos;re on {here}. Open <strong className="text-amber-200/95">New goal</strong> to continue.
      </>
    )
  }
  if (step.routePrefix === "/plan/") {
    if (currentPath === "/app" || currentPath === "/goals" || currentPath === "/new-goal") {
      return (
        <>
          You&apos;re on <strong className="text-amber-200/95">{here}</strong>. Open a goal from{" "}
          <strong className="text-amber-200/95">Goals</strong> (or finish building one) to reach your plan.
        </>
      )
    }
    return (
      <>
        You&apos;re on {here}. Open an existing goal from <strong className="text-amber-200/95">Goals</strong> to view its
        plan.
      </>
    )
  }
  return <>Move to the right screen for this step.</>
}

function buildStepDisplay(step: OnboardingStep, nickname: string | undefined): { title: string; body: string } {
  if (step.id === "home-intro" && nickname?.trim()) {
    return {
      title: `Nice to meet you, ${nickname.trim()} — this is your command center.`,
      body: step.body,
    }
  }
  return { title: step.title, body: step.body }
}

function getVisibleTourElement(targetId: string): HTMLElement | null {
  const list = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour-id="${targetId}"]`))
  for (const el of list) {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return el
  }
  return null
}

function FocusedOnboarding({
  enabled,
  currentPath,
}: {
  enabled: boolean
  currentPath: string
}) {
  const { user } = useAuth()
  const { profile } = useProfileDialog()
  const navigate = useNavigate()
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [tourEntryPath, setTourEntryPath] = useState<string | null>(null)

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", "onboarding", user?.uid],
    queryFn: () => (user ? getUserGoals(user.uid) : Promise.resolve([])),
    enabled: !!user && active,
  })

  const firstGoalCreated = goals.length > 0

  const steps: OnboardingStep[] = [
    {
      id: "home-intro",
      routePrefix: "/app",
      targetId: "home-chat-input",
      title: "This is your command center.",
      body: "Tell Duwit your goal in plain language. It will convert intent into practical next actions.",
      actionLabel: "Continue",
      waitForTarget: true,
    },
    {
      id: "go-to-new-goal",
      routePrefix: "/app",
      targetId: "nav-new-goal",
      title: "Now we build your first goal.",
      body: "Use New to open the guided goal builder. I will stay with you until your first goal is created.",
      actionLabel: "Open New Goal",
      actionTo: "/new-goal",
      waitForTarget: true,
    },
    {
      id: "goal-chat",
      routePrefix: "/new-goal",
      targetId: "goal-chat-input",
      title: "Describe what you want to achieve.",
      body: "Start chatting here. The assistant asks questions, sharpens scope, then prepares a plan.",
      actionLabel: "Continue",
      waitForTarget: true,
    },
    {
      id: "wait-first-goal",
      routePrefix: "/new-goal",
      targetId: "goal-build-plan",
      fallbackTargetId: "goal-chat-input",
      title: "When this appears, tap Build Plan.",
      body: "Keep chatting until the assistant says the plan is ready. Then tap Build Plan — it creates your first goal and opens the roadmap.",
      actionLabel: "I will do it now",
      waitForTarget: true,
    },
    {
      id: "plan-overview",
      routePrefix: "/plan/",
      targetId: "plan-phases",
      title: "This is your roadmap.",
      body: "Each phase contains tasks. Completing tasks updates progress and keeps the assistant aligned with your journey.",
      actionLabel: "Continue",
      waitForTarget: true,
    },
    {
      id: "task-navigation",
      routePrefix: "/plan/",
      targetId: "task-chat-nav",
      fallbackTargetId: "plan-phases",
      title: "Move task to task here.",
      body: "Open any task chat from the plan, then use these arrows to move forward or backward without losing context.",
      actionLabel: "Continue",
      waitForTarget: true,
    },
    {
      id: "task-coach",
      routePrefix: "/plan/",
      targetId: "task-chat-input",
      fallbackTargetId: "plan-phases",
      title: "Task chat adapts to your progress.",
      body: "This coach remembers your goal state, what you completed, and what you struggled with. Ask for help exactly where you are stuck.",
      actionLabel: "Finish onboarding",
      waitForTarget: true,
    },
  ]

  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const atLastStep = stepIndex >= steps.length - 1
  const routeOk = routeMatches(step.routePrefix, currentPath)
  const hasAnyTargetId = Boolean(step.targetId || step.fallbackTargetId)
  const missingTarget = hasAnyTargetId && !targetRect
  const canProceed = routeOk && (!step.waitForTarget || !missingTarget)

  const startedMidTour = tourEntryPath !== null && getMinStepIndexForPath(tourEntryPath) >= 2
  const showMidTourHint =
    startedMidTour && routeOk && (step.id === "goal-chat" || step.id === "wait-first-goal")
  const { title: displayTitle, body: displayBody } = buildStepDisplay(step, profile?.nickname)

  useLayoutEffect(() => {
    if (!active) {
      setTourEntryPath(null)
      return
    }
    setTourEntryPath((p) => p ?? currentPath)
  }, [active, currentPath])

  useEffect(() => {
    if (!enabled || !user) {
      setActive(false)
      return
    }
    try {
      if (localStorage.getItem(ONBOARDING_DONE_KEY) === "1") {
        setActive(false)
        return
      }
      // Refresh behavior: if onboarding is not finished/skipped, always restart from step 0.
      setStepIndex(0)
      setActive(true)
    } catch {
      setActive(true)
      setStepIndex(0)
    }
  }, [enabled, user])

  useEffect(() => {
    if (!active) return
    const m = getMinStepIndexForPath(currentPath)
    setStepIndex((i) => Math.max(i, m))
  }, [active, currentPath])

  useEffect(() => {
    if (!active) return
    if (step.id === "wait-first-goal" && firstGoalCreated && currentPath.startsWith("/plan/")) {
      setStepIndex((s) => Math.min(s + 1, steps.length - 1))
    }
  }, [active, step.id, firstGoalCreated, currentPath, steps.length])

  useEffect(() => {
    if (!active) return
    if (step.actionTo && currentPath === step.actionTo) {
      setStepIndex((s) => Math.min(s + 1, steps.length - 1))
    }
  }, [active, step.actionTo, currentPath, steps.length])

  useEffect(() => {
    const preferredId = step.targetId ?? step.fallbackTargetId
    if (!active || !preferredId || !routeOk) {
      setTargetRect(null)
      return
    }
    function updateRect() {
      const primary = step.targetId ? getVisibleTourElement(step.targetId) : null
      const fallback = step.fallbackTargetId ? getVisibleTourElement(step.fallbackTargetId) : null
      const el = primary ?? fallback
      setTargetRect(el ? el.getBoundingClientRect() : null)
    }
    updateRect()
    const iv = window.setInterval(updateRect, 140)
    const onResize = () => updateRect()
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onResize, true)
    return () => {
      window.clearInterval(iv)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onResize, true)
    }
  }, [active, routeOk, step.targetId, step.fallbackTargetId])

  function finishOnboarding() {
    setActive(false)
    try {
      localStorage.setItem(ONBOARDING_DONE_KEY, "1")
    } catch {}
  }

  function restartOnboarding() {
    setTourEntryPath(null)
    setActive(true)
    setStepIndex(0)
    try {
      localStorage.removeItem(ONBOARDING_DONE_KEY)
    } catch {}
  }

  function nextStep() {
    if (!canProceed) return
    if (step.actionTo && currentPath !== step.actionTo) {
      navigate({ to: step.actionTo })
      return
    }
    if (atLastStep) {
      finishOnboarding()
      return
    }
    setStepIndex((s) => Math.min(s + 1, steps.length - 1))
  }

  if (!active) return null

  const pad = 10
  const hole = targetRect
    ? {
        top: Math.max(0, targetRect.top - pad),
        left: Math.max(0, targetRect.left - pad),
        right: Math.min(window.innerWidth, targetRect.right + pad),
        bottom: Math.min(window.innerHeight, targetRect.bottom + pad),
      }
    : null

  const CARD_W = 360
  const CARD_H = 220
  const GAP = 22
  const isGoalCreationFlow = currentPath.startsWith("/new-goal")

  const pickCardPos = () => {
    if (isGoalCreationFlow) {
      return {
        right: 12,
        top: 12,
      }
    }
    if (!hole) {
      return { right: 12, top: 12 }
    }
    const focusRect = hole
    const left = Math.max(12, Math.min(window.innerWidth - CARD_W - 12, focusRect.left))
    const belowTop = focusRect.bottom + GAP
    const aboveTop = focusRect.top - GAP - CARD_H
    const canFitBelow = belowTop + CARD_H <= window.innerHeight - 12
    const canFitAbove = aboveTop >= 12

    function overlapsHole(cardTop: number) {
      const cardBottom = cardTop + CARD_H
      return cardBottom > focusRect.top && cardTop < focusRect.bottom
    }

    let top = canFitBelow ? belowTop : canFitAbove ? aboveTop : Math.min(window.innerHeight - CARD_H - 12, belowTop)
    if (overlapsHole(top)) {
      if (canFitAbove && aboveTop >= 12) top = aboveTop
      else if (canFitBelow) top = belowTop
    }
    if (overlapsHole(top)) {
      top = Math.max(12, Math.min(window.innerHeight - CARD_H - 12, focusRect.top - CARD_H - GAP))
    }
    return { left, top }
  }

  const cardStyle = pickCardPos()
  const shouldHighlightTarget = Boolean(step.waitForTarget && hole && routeOk)

  return (
    <div className="fixed inset-0 z-85 pointer-events-none">
      {shouldHighlightTarget && hole ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.01, 1] }}
            transition={{ duration: 3.2, ease: "easeInOut", repeat: Infinity }}
            className="absolute rounded-xl border border-brand/60 shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_0_18px_rgba(99,102,241,0.18)] pointer-events-none"
            style={{ top: hole.top, left: hole.left, width: hole.right - hole.left, height: hole.bottom - hole.top }}
          />
        </>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="absolute w-[min(92vw,22rem)] rounded-2xl border border-white/20 bg-zinc-950/94 text-white p-4 shadow-2xl pointer-events-auto"
        style={cardStyle}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo.svg" alt="Duwit" className="h-5 w-5 shrink-0" />
            <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide truncate">
              Quick tour ({stepIndex + 1}/{steps.length})
            </p>
          </div>
          <button
            type="button"
            onClick={restartOnboarding}
            className="h-7 w-7 rounded-full border border-white/15 text-zinc-200 hover:bg-white/10 flex items-center justify-center"
            title="Restart tutorial"
            aria-label="Restart tutorial"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-sm font-semibold leading-snug">{displayTitle}</p>
        <p className="mt-1.5 text-xs text-zinc-300 leading-relaxed">{displayBody}</p>
        {showMidTourHint && (
          <p className="mt-2 text-[11px] text-emerald-300/95 leading-snug">
            You opened this flow directly — we&apos;re aligned with where you are.
          </p>
        )}
        {!routeOk && (
          <p className="mt-2 text-[11px] text-amber-300 leading-snug">{renderWrongRouteHint(step, currentPath)}</p>
        )}
        {step.waitForTarget && missingTarget && routeOk && (
          <p className="mt-2 text-[11px] text-amber-300">
            Waiting for this section to appear...
          </p>
        )}
        <div className="mt-3 flex justify-between gap-2">
          <button
            type="button"
            onClick={finishOnboarding}
            className="h-8 px-3 rounded-lg text-xs font-semibold border border-white/20 text-zinc-300 hover:bg-white/10"
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={nextStep}
            disabled={!canProceed}
            className="h-8 px-3 rounded-lg text-xs font-semibold bg-white text-zinc-900 disabled:opacity-45"
          >
            {step.actionLabel ?? "Next"}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function SettingsDrawerPanel({
  settingsOpen,
  setSettingsOpen,
  isElectron,
}: {
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
  isElectron: boolean
}) {
  const { user } = useAuth()
  const { openPreferencesEditor } = useProfileDialog()
  const {
    selectedModel,
    setSelectedModel,
    selectedImageModel,
    setSelectedImageModel,
  } = useModel()
  const { voiceLiveModel, setVoiceLiveModel } = useVoiceLiveModel()
  const navigate = useNavigate()

  const [aiOpen, setAiOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!profileMenuRef.current?.contains(e.target as Node)) setProfileMenuOpen(false)
    }
    if (profileMenuOpen) document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [profileMenuOpen])

  useEffect(() => {
    if (!settingsOpen) return
    setAiOpen(false)
    setPrefsOpen(false)
    setProfileMenuOpen(false)
  }, [settingsOpen])

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
  const textModelOptions = AVAILABLE_MODELS as ReadonlyArray<{
    id: ModelId
    name: string
    description: string
  }>

  return (
    <motion.div
      initial={false}
      animate={{
        x: settingsOpen ? 0 : "100%",
        opacity: settingsOpen ? 1 : 0.985,
      }}
      transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.85 }}
      className={`fixed right-0 bottom-0 z-50 w-full sm:w-104 max-w-full bg-card border-l border-border/80 flex flex-col shadow-2xl ${
        isElectron ? "top-10" : "top-0"
      }`}
    >
      <div className="flex items-center justify-between px-5 sm:px-6 h-14 border-b border-border/70 shrink-0">
        <span className="font-bold text-base">Settings</span>
        <button
          type="button"
          onClick={() => setSettingsOpen(false)}
          className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/70 transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 sm:py-6 space-y-4 min-h-0">
        <div className="rounded-2xl border border-border/70 overflow-hidden bg-background">
          <button
            type="button"
            onClick={() => setAiOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3.5 text-left bg-muted/20 hover:bg-muted/40 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-brand shrink-0" />
              AI
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", aiOpen && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {aiOpen && (
              <motion.div
                key="ai-settings-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: "easeInOut" }}
                className="overflow-hidden border-t border-border/60"
              >
                <div className="px-4 pb-4 pt-3 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="text-model" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Text model
                </label>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button id="text-model" type="button" variant="outline" className="w-full justify-between rounded-xl">
                      <span className="truncate">{textModelOptions.find((m) => m.id === selectedModel)?.name ?? "Select text model"}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                    {textModelOptions.map((m) => (
                      <DropdownMenuItem key={`text-${m.id}`} onClick={() => setSelectedModel(m.id as ModelId)}>
                        <span className="flex w-full items-center justify-between gap-2">
                          <span>{m.name}</span>
                          {selectedModel === m.id ? <Check className="h-4 w-4 text-primary" /> : null}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="pt-2 border-t border-border/50 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Search model (web-grounded)</p>
                <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
                  <p className="text-sm font-medium">Gemini 2.5 Flash</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Fixed for web-grounded responses.</p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50 space-y-1.5">
                <label htmlFor="image-model" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Image model
                </label>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button id="image-model" type="button" variant="outline" className="w-full justify-between rounded-xl">
                      <span className="truncate">{IMAGE_MODELS.find((m) => m.id === selectedImageModel)?.name ?? "Select image model"}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                    {IMAGE_MODELS.map((m) => (
                      <DropdownMenuItem key={`image-${m.id}`} onClick={() => setSelectedImageModel(m.id as ImageModelId)}>
                        <span className="flex w-full items-center justify-between gap-2">
                          <span>{m.name}</span>
                          {selectedImageModel === m.id ? <Check className="h-4 w-4 text-primary" /> : null}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="pt-2 border-t border-border/50 space-y-1.5">
                <label htmlFor="voice-model" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Voice call model
                </label>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button id="voice-model" type="button" variant="outline" className="w-full justify-between rounded-xl">
                      <span className="truncate">{VOICE_LIVE_OPTIONS.find((m) => m.id === voiceLiveModel)?.name ?? "Select voice model"}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                    {VOICE_LIVE_OPTIONS.map((opt) => (
                      <DropdownMenuItem key={opt.id} onClick={() => setVoiceLiveModel(opt.id as VoiceLiveModelChoice)}>
                        <span className="flex w-full items-center justify-between gap-2">
                          <span>{opt.name}</span>
                          {voiceLiveModel === opt.id ? <Check className="h-4 w-4 text-primary" /> : null}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Preferences */}
        <div className="rounded-2xl border border-border/70 overflow-hidden bg-background">
          <button
            type="button"
            onClick={() => setPrefsOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3.5 text-left bg-muted/20 hover:bg-muted/40 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
              Preferences
            </span>
            <ChevronDown
              className={cn("h-4 w-4 text-muted-foreground transition-transform", prefsOpen && "rotate-180")}
            />
          </button>
          <AnimatePresence initial={false}>
            {prefsOpen && (
              <motion.div
                key="prefs-settings-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="overflow-hidden border-t border-border/60"
              >
                <div className="px-4 pb-4 pt-3 space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Profile card */}
      <div className="shrink-0 border-t border-border/70 p-4 bg-muted/15">
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
    </motion.div>
  )
}

function RootLayout() {
  const { user, loading: authLoading } = useAuth()
  const { tutorialCanStart } = useProfileDialog()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [showMobileSwipeHint, setShowMobileSwipeHint] = useState(false)
  const touchStartXRef = useRef<number | null>(null)
  const touchCurrentXRef = useRef<number | null>(null)
  const mobileHintDelayTimerRef = useRef<number | null>(null)
  const navigate = useNavigate()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const isElectron =
    typeof window !== "undefined" &&
    typeof (window as Window & { electron?: unknown }).electron !== "undefined"

  const tabs = [
    { to: "/app", icon: Home, label: "Home" },
    { to: "/goals", icon: Target, label: "Goals" },
    { to: "/new-goal", icon: Plus, label: "New" },
  ]

  const isTabRoute = currentPath === "/app" || currentPath === "/goals" || currentPath === "/new-goal"
  const isPublicScrollableRoute = currentPath === "/" || currentPath === "/login" || currentPath === "/classic"
  const outletAllowsPageScroll = isTabRoute || isPublicScrollableRoute
  const showMainChrome = !authLoading && user

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (!showMainChrome) return
    if (!isMobileViewport()) return
    touchStartXRef.current = e.touches[0]?.clientX ?? null
    touchCurrentXRef.current = touchStartXRef.current
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!showMainChrome) return
    if (!isMobileViewport()) return
    if (touchStartXRef.current === null) return
    touchCurrentXRef.current = e.touches[0]?.clientX ?? null
  }

  function onTouchEnd() {
    if (!showMainChrome) return
    if (!isMobileViewport()) return
    const start = touchStartXRef.current
    const end = touchCurrentXRef.current
    touchStartXRef.current = null
    touchCurrentXRef.current = null
    if (start === null || end === null) return
    const dx = end - start
    const startedNearRightEdge = start >= window.innerWidth - 28
    if (!mobileNavOpen && !isTabRoute && startedNearRightEdge && dx < -48) {
      setMobileNavOpen(true)
      setShowMobileSwipeHint(false)
      try {
        localStorage.setItem(MOBILE_SWIPE_HINT_KEY, "1")
      } catch {}
      return
    }
    if (mobileNavOpen && dx > 48) {
      setMobileNavOpen(false)
    }
  }

  useEffect(() => {
    if (isTabRoute) setMobileNavOpen(false)
  }, [isTabRoute])

  useEffect(() => {
    if (!showMainChrome) return
    if (isTabRoute) return
    if (!isMobileViewport()) return
    try {
      if (localStorage.getItem(MOBILE_SWIPE_HINT_KEY) === "1") return
    } catch {}
    if (mobileHintDelayTimerRef.current) {
      window.clearTimeout(mobileHintDelayTimerRef.current)
      mobileHintDelayTimerRef.current = null
    }
    mobileHintDelayTimerRef.current = window.setTimeout(() => {
      setShowMobileSwipeHint(true)
      mobileHintDelayTimerRef.current = null
    }, 2200)
    return () => {
      if (mobileHintDelayTimerRef.current) {
        window.clearTimeout(mobileHintDelayTimerRef.current)
        mobileHintDelayTimerRef.current = null
      }
    }
  }, [showMainChrome, isTabRoute, currentPath])

  return (
    <div
      className="h-svh overflow-hidden bg-background flex flex-col"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <DesktopTitleBar />

      <main className="flex-1 w-full min-h-0 flex flex-col">
        <div className={`flex-1 flex flex-col min-h-0 ${outletAllowsPageScroll ? "overflow-y-auto" : "overflow-hidden"}`}>
          <Outlet />
        </div>
      </main>

      {showMainChrome && (
        <>
          {/* Desktop side rail */}
          <aside className="hidden sm:flex fixed right-5 top-1/2 -translate-y-1/2 z-40 flex-col gap-1 rounded-2xl border border-white/10 bg-zinc-900/90 text-zinc-100 backdrop-blur-md p-1.5 shadow-xl">
            <div className="h-10 w-10 flex items-center justify-center mb-1 rounded-xl bg-white/12 ring-1 ring-white/20 shadow-sm">
              <img src="/logo.svg" alt="Duwit logo" className="h-9 w-9 object-contain brightness-110" />
            </div>
            {tabs.map(({ to, icon: Icon, label }) => {
              const isActive = currentPath === to
              return (
                <button
                  key={to}
                  type="button"
                  onClick={() => navigate({ to })}
                  data-tour-id={
                    to === "/new-goal"
                      ? "nav-new-goal"
                      : to === "/goals"
                        ? "nav-goals"
                        : to === "/app"
                          ? "nav-home"
                          : undefined
                  }
                  className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
                    isActive
                      ? "bg-white text-zinc-900"
                      : "text-zinc-300 hover:text-white hover:bg-white/10"
                  }`}
                  title={label}
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
            <div className="my-1 h-px bg-border/70" />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="h-10 w-10 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </aside>

          {/* Mobile bottom navigation */}
          {isTabRoute && (
            <nav className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/92 backdrop-blur-md px-2 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] pt-2">
              <div className="flex items-center gap-1">
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {tabs.map(({ to, icon: Icon, label }) => {
                    const isActive = currentPath === to
                    return (
                      <button
                        key={to}
                        type="button"
                        onClick={() => navigate({ to })}
                        data-tour-id={
                          to === "/new-goal"
                            ? "nav-new-goal"
                            : to === "/goals"
                              ? "nav-goals"
                              : to === "/app"
                                ? "nav-home"
                                : undefined
                        }
                        className={`h-11 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="h-8 w-px bg-border/80 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="h-11 w-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors shrink-0"
                  aria-label="Settings"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </nav>
          )}

          {/* Mobile swipe-in side pill for focused routes (e.g. task chat) */}
          {!isTabRoute && (
            <>
              {!mobileNavOpen && (
                <div
                  className="sm:hidden fixed top-0 right-0 h-full w-7 z-40"
                  aria-hidden
                />
              )}
              {showMobileSwipeHint && !mobileNavOpen && (
                <AnimatePresence>
                  <motion.div
                    key="mobile-swipe-hint-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="sm:hidden fixed inset-0 z-45 pointer-events-none"
                  >
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/45"
                    />
                    <motion.div
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute top-0 right-0 h-full w-20 bg-linear-to-l from-brand/40 via-brand/10 to-transparent"
                    />
                    <motion.div
                      initial={{ x: 0 }}
                      animate={{ x: [-2, -18, -2] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute right-6 top-1/2 -translate-y-1/2 text-white/95 text-xl font-black"
                    >
                      ‹
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.28, delay: 0.05 }}
                      className="absolute left-4 right-4 bottom-20 rounded-2xl border border-white/20 bg-zinc-900/92 text-white px-4 py-3.5 shadow-xl pointer-events-auto"
                    >
                      <p className="text-sm font-semibold">Quick navigation</p>
                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                        Swipe from the right edge to open navigation while you are in chat.
                      </p>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="h-8 px-3 rounded-lg bg-white text-zinc-900 text-xs font-semibold"
                          onClick={() => {
                            setShowMobileSwipeHint(false)
                            try {
                              localStorage.setItem(MOBILE_SWIPE_HINT_KEY, "1")
                            } catch {}
                          }}
                        >
                          Got it
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              )}
              {mobileNavOpen && (
                <div
                  className="sm:hidden fixed inset-0 z-40 bg-black/25"
                  onClick={() => setMobileNavOpen(false)}
                />
              )}
              <aside
                className={`sm:hidden fixed right-3 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1 rounded-2xl border border-white/10 bg-zinc-900/92 text-zinc-100 backdrop-blur-md p-1.5 shadow-xl transition-transform duration-200 ${
                  mobileNavOpen ? "translate-x-0" : "translate-x-[calc(100%+1.25rem)]"
                }`}
              >
                <div className="h-10 w-10 flex items-center justify-center mb-1 rounded-xl bg-white/12 ring-1 ring-white/20 shadow-sm">
                  <img src="/logo.svg" alt="Duwit logo" className="h-9 w-9 object-contain brightness-110" />
                </div>
                {tabs.map(({ to, icon: Icon, label }) => {
                  const isActive = currentPath === to
                  return (
                    <button
                      key={`mobile-side-${to}`}
                      type="button"
                      onClick={() => {
                        navigate({ to })
                        setMobileNavOpen(false)
                      }}
                      data-tour-id={
                        to === "/new-goal"
                          ? "nav-new-goal"
                          : to === "/goals"
                            ? "nav-goals"
                            : to === "/app"
                              ? "nav-home"
                              : undefined
                      }
                      className={`h-10 w-28 px-3 justify-start gap-2 rounded-xl flex items-center transition-colors ${
                        isActive
                          ? "bg-white text-zinc-900"
                          : "text-zinc-300 hover:text-white hover:bg-white/10"
                      }`}
                      title={label}
                      aria-label={label}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  )
                })}
                <div className="my-1 h-px bg-white/15" />
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(true)
                    setMobileNavOpen(false)
                  }}
                  className="h-10 w-28 px-3 justify-start gap-2 rounded-xl flex items-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Settings"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                  <span className="text-xs font-medium">Settings</span>
                </button>
              </aside>
            </>
          )}
        </>
      )}

      <FocusedOnboarding enabled={tutorialCanStart} currentPath={currentPath} />

      {settingsOpen && (
        <div
          className={`fixed z-40 bg-black/50 backdrop-blur-sm ${
            isElectron ? "inset-x-0 bottom-0 top-10" : "inset-0"
          }`}
          onClick={() => setSettingsOpen(false)}
        />
      )}

      <SettingsDrawerPanel settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} isElectron={isElectron} />
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
