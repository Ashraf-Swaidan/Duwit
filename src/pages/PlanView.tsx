import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { PhaseCard } from "@/components/PhaseCard"
import { TaskChat } from "@/components/TaskChat"
import { auth } from "@/lib/firebase"
import { getGoal, updateTaskCompletion, type Goal, type Task } from "@/services/goals"

interface PlanViewProps {
  goalId: string
  onBack?: () => void
}

interface ActiveChat {
  task: Task
  phaseIndex: number
  taskIndex: number
  phaseTitle: string
}

export function PlanView({ goalId, onBack }: PlanViewProps) {
  const user = auth.currentUser
  const [goal, setGoal] = useState<Goal | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getGoal(user.uid, goalId)
      .then((data) => {
        if (!data) setError("Goal not found")
        else setGoal(data)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load goal"))
      .finally(() => setLoading(false))
  }, [user, goalId])

  async function handleTaskToggle(phaseIndex: number, taskIndex: number, completed: boolean) {
    if (!user || !goal) return
    setUpdating(true)
    try {
      await updateTaskCompletion(user.uid, goalId, phaseIndex, taskIndex, completed)
      const updated = await getGoal(user.uid, goalId)
      if (updated) setGoal(updated)
    } catch (e) {
      console.error("Failed to update task:", e)
    } finally {
      setUpdating(false)
    }
  }

  function handleOpenGuide(phaseIndex: number, taskIndex: number) {
    if (!goal) return
    const phase = goal.phases[phaseIndex]
    const task = phase?.tasks[taskIndex]
    if (!task) return
    setActiveChat({ task, phaseIndex, taskIndex, phaseTitle: phase.title })
  }

  if (loading) {
    return (
      <div className="px-4 pt-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-3xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error || !goal) {
    return (
      <div className="px-4 pt-8 space-y-4">
        <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4">
          <p className="text-sm text-destructive">{error ?? "Goal not found"}</p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Goals
          </button>
        )}
      </div>
    )
  }

  const totalTasks = goal.phases.reduce((a, p) => a + p.tasks.length, 0)
  const doneTasks = goal.phases.reduce((a, p) => a + p.tasks.filter((t) => t.completed).length, 0)
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <>
      <div className="px-4 pt-6 pb-24 space-y-6">
        {/* Back nav */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
          >
            <ArrowLeft className="h-4 w-4" />
            My Goals
          </button>
        )}

        {/* Goal header */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-tight">
              {goal.title}
            </h1>
            {goal.description && (
              <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
            )}
          </div>

          {/* Progress */}
          <div className="bg-card rounded-2xl border p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall progress</span>
              <span className="font-bold">{doneTasks}/{totalTasks} tasks</span>
            </div>
            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {goal.phases.map((phase, i) => {
                  const pTotal = phase.tasks.length
                  const pDone = phase.tasks.filter((t) => t.completed).length
                  const full = pDone === pTotal && pTotal > 0
                  return (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        full ? "bg-brand" : pDone > 0 ? "bg-brand/50" : "bg-muted-foreground/20"
                      }`}
                    />
                  )
                })}
              </div>
              <span className="text-xs font-bold text-muted-foreground ml-3">{progress}%</span>
            </div>
          </div>
        </div>

        {/* Phases */}
        <div className="space-y-3">
          {goal.phases.map((phase, phaseIndex) => (
            <PhaseCard
              key={phaseIndex}
              phase={phase}
              phaseIndex={phaseIndex}
              goalId={goalId}
              goalTitle={goal.title}
              onTaskToggle={handleTaskToggle}
              onOpenGuide={handleOpenGuide}
              loading={updating}
            />
          ))}
        </div>
      </div>

      {/* Full-screen chat overlay */}
      {activeChat && (
        <TaskChat
          task={activeChat.task}
          goalId={goalId}
          goalTitle={goal.title}
          phaseTitle={activeChat.phaseTitle}
          phaseIndex={activeChat.phaseIndex}
          taskIndex={activeChat.taskIndex}
          onClose={() => setActiveChat(null)}
        />
      )}
    </>
  )
}

export default PlanView
