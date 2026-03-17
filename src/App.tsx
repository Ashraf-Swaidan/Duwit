import { useState, useEffect } from "react"
import { signOut } from "firebase/auth"
import { Settings, Plus, LogOut, Cpu, Check, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AuthForm } from "@/components/AuthForm"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/hooks/useAuth"
import { getUserGoals, type Goal } from "@/services/goals"
import { ModelProvider, useModel, AVAILABLE_MODELS, type ModelId } from "@/contexts/ModelContext"
import GoalChat from "@/pages/GoalChat"
import PlanView from "@/pages/PlanView"

type AppView = "dashboard" | "new-goal" | "plan"

function AppContent() {
  const { user, loading: authLoading } = useAuth()
  const { selectedModel, setSelectedModel } = useModel()
  const [activeView, setActiveView] = useState<AppView>("dashboard")
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalsLoading, setGoalsLoading] = useState(false)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (user) {
      setGoalsLoading(true)
      getUserGoals(user.uid)
        .then(setGoals)
        .catch((e) => console.error("Failed to load goals:", e))
        .finally(() => setGoalsLoading(false))
    }
  }, [user])

  function refreshGoals() {
    if (!user) return
    setGoalsLoading(true)
    getUserGoals(user.uid)
      .then(setGoals)
      .finally(() => setGoalsLoading(false))
  }

  async function handleLogout() {
    try {
      await signOut(auth)
    } catch (e) {
      console.error("Logout failed:", e)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <span className="text-2xl font-black tracking-tight">Duwit</span>
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
          </div>
        </div>
      </div>
    )
  }

  if (!user) return <AuthForm />

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => setActiveView("dashboard")}
            className="font-black text-xl tracking-tight hover:opacity-60 transition-opacity"
          >
            Duwit
          </button>

          <div className="flex items-center gap-1">
            {activeView === "dashboard" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveView("new-goal")}
                className="gap-1.5 rounded-full h-8 px-3 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                New Goal
              </Button>
            )}
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

      {/* Main content area */}
      <main className="flex-1 max-w-lg mx-auto w-full">
        {activeView === "dashboard" && (
          <Dashboard
            user={user}
            goals={goals}
            goalsLoading={goalsLoading}
            onNewGoal={() => setActiveView("new-goal")}
            onSelectGoal={(id) => {
              setSelectedGoalId(id)
              setActiveView("plan")
            }}
          />
        )}

        {activeView === "new-goal" && (
          <GoalChat
            onSuccess={(goalId) => {
              setSelectedGoalId(goalId)
              setActiveView("plan")
              refreshGoals()
            }}
            onBack={() => setActiveView("dashboard")}
          />
        )}

        {activeView === "plan" && selectedGoalId && (
          <PlanView
            goalId={selectedGoalId}
            onBack={() => {
              setActiveView("dashboard")
              setSelectedGoalId(null)
            }}
          />
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

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({
  user,
  goals,
  goalsLoading,
  onNewGoal,
  onSelectGoal,
}: {
  user: { displayName?: string | null; email?: string | null }
  goals: Goal[]
  goalsLoading: boolean
  onNewGoal: () => void
  onSelectGoal: (id: string) => void
}) {
  const firstName =
    user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "there"
  const hour = new Date().getHours()
  const greeting =
    hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  const totalCompleted = goals.reduce((sum, g) => sum + ((g.progress ?? 0) >= 100 ? 1 : 0), 0)

  return (
    <div className="px-4 pt-8 pb-24 space-y-8">
      {/* Greeting */}
      <div>
        <p className="text-muted-foreground text-sm font-medium">{greeting}</p>
        <h1 className="text-4xl font-black tracking-tight mt-1">
          {firstName}<span className="text-brand">.</span>
        </h1>
        {goals.length > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            {goals.length} active {goals.length === 1 ? "goal" : "goals"}
            {totalCompleted > 0 && ` · ${totalCompleted} completed`}
          </p>
        )}
      </div>

      {/* Goals list */}
      {goalsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-3xl border bg-card h-28 animate-pulse opacity-60"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border/70 px-6 py-14 text-center space-y-4">
          <div className="text-5xl">🎯</div>
          <div>
            <h3 className="font-bold text-lg">What's your first goal?</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Tell us what you want to achieve and we'll build a personalized plan for you.
            </p>
          </div>
          <Button onClick={onNewGoal} className="rounded-full px-7 h-11 font-semibold">
            Create a Goal
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const progress = goal.progress ?? 0
            const totalTasks = goal.phases?.reduce((a, p) => a + p.tasks.length, 0) ?? 0
            const doneTasks = goal.phases?.reduce(
              (a, p) => a + p.tasks.filter((t) => t.completed).length,
              0,
            ) ?? 0

            return (
              <button
                key={goal.id}
                onClick={() => onSelectGoal(goal.id ?? "")}
                className="w-full text-left rounded-3xl border bg-card px-5 py-5 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all duration-200 group"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-bold text-base leading-snug line-clamp-2 flex-1">
                    {goal.title}
                  </h3>
                  <span className="shrink-0 text-xs font-bold text-muted-foreground mt-0.5">
                    {progress}%
                  </span>
                </div>

                {goal.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-1">
                    {goal.description}
                  </p>
                )}

                <div className="space-y-1.5">
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {totalTasks > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {doneTasks} of {totalTasks} tasks done
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── App root ─────────────────────────────────────────────────────────────────

export function App() {
  return (
    <ModelProvider>
      <AppContent />
    </ModelProvider>
  )
}

export default App
