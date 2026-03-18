import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { PhaseCard } from "@/components/PhaseCard"
import { TaskChat } from "@/components/TaskChat"
import { auth } from "@/lib/firebase"
import { getGoal, updateTaskCompletion, type Task } from "@/services/goals"
import { useQuery, useQueryClient } from "@tanstack/react-query"

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
  const queryClient = useQueryClient()
  const [updating, setUpdating] = useState(false)
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null)

  const { data: goal, isLoading: loading, error } = useQuery({
    queryKey: ['goal', goalId],
    queryFn: () => (user ? getGoal(user.uid, goalId) : Promise.resolve(null)),
    enabled: !!user && !!goalId,
  })

  async function handleTaskToggle(phaseIndex: number, taskIndex: number, completed: boolean) {
    if (!user || !goal) return
    setUpdating(true)
    try {
      await updateTaskCompletion(user.uid, goalId, phaseIndex, taskIndex, completed)
      await queryClient.invalidateQueries({ queryKey: ["goal", goalId] })
      await queryClient.invalidateQueries({ queryKey: ["goals"] })
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
          <p className="text-sm text-destructive">{(error as Error)?.message ?? "Goal not found"}</p>
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
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-background overflow-hidden">
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Main Plan Area */}
        <div
          className={`h-full overflow-y-auto transition-all duration-300 scroll-smooth ${
            activeChat ? "hidden lg:block lg:w-2/5 lg:max-w-sm xl:max-w-md lg:border-r border-border/60" : "w-full"
          }`}
        >
          <div className="px-4 pt-6 pb-24 space-y-6 max-w-4xl mx-auto">
            {/* Goal header with back button */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="shrink-0 mt-1 p-1 -ml-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Back to My Goals"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-black tracking-tight leading-tight">
                    {goal.title}
                  </h1>
                  {goal.description && (
                    <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                  )}
                </div>
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
                  <div className="flex gap-1 flex-1">
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
                  activeTaskIndex={activeChat?.phaseIndex === phaseIndex ? activeChat.taskIndex : undefined}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Chat Area (Responsive) */}
        {activeChat && (
          <div className="flex-1 bg-background relative z-40 lg:z-0 animate-in slide-in-from-right duration-300 h-full overflow-hidden">
            <TaskChat
              task={activeChat.task}
              goalId={goalId}
              goalTitle={goal.title}
              phaseTitle={activeChat.phaseTitle}
              phaseIndex={activeChat.phaseIndex}
              taskIndex={activeChat.taskIndex}
              goalProfile={goal.profile}
              phaseTasks={goal.phases[activeChat.phaseIndex].tasks}
              onClose={() => setActiveChat(null)}
              isDesktopSideView={true}
              onMarkComplete={() =>
                handleTaskToggle(activeChat.phaseIndex, activeChat.taskIndex, true)
              }
              onNavigateTask={(direction: number) => {
                let nextPhaseIndex = activeChat.phaseIndex
                let nextTaskIndex = activeChat.taskIndex + direction

                if (nextTaskIndex < 0) {
                  nextPhaseIndex--
                  if (nextPhaseIndex >= 0) {
                    nextTaskIndex = goal.phases[nextPhaseIndex].tasks.length - 1
                  } else {
                    return
                  }
                } else if (nextTaskIndex >= goal.phases[nextPhaseIndex].tasks.length) {
                  nextPhaseIndex++
                  if (nextPhaseIndex < goal.phases.length) {
                    nextTaskIndex = 0
                  } else {
                    return
                  }
                }

                handleOpenGuide(nextPhaseIndex, nextTaskIndex)
              }}
              hasPrevTask={activeChat.phaseIndex > 0 || activeChat.taskIndex > 0}
              hasNextTask={
                activeChat.phaseIndex < goal.phases.length - 1 ||
                activeChat.taskIndex < goal.phases[activeChat.phaseIndex].tasks.length - 1
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default PlanView
