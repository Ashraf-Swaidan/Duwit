import { useState, useEffect, useLayoutEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Trash2 } from "lucide-react"
import { PhaseCard } from "@/components/PhaseCard"
import { TaskChat } from "@/components/TaskChat"
import { DeleteGoalConfirm } from "@/components/DeleteGoalConfirm"
import { auth } from "@/lib/firebase"
import { GoalCompleteCelebration } from "@/components/GoalCompleteCelebration"
import {
  deleteGoal,
  getGoal,
  isGoalCompleted,
  updateTaskCompletion,
} from "@/services/goals"
import { recordTaskMarkedCompleteInGoalState } from "@/services/goalState"
import { notifyHomeGoalsChanged } from "@/services/userContext"
import { useProfileDialog } from "@/contexts/ProfileDialogContext"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

interface PlanViewProps {
  goalId: string
  onBack?: () => void
}

/** Only indices — task + phase titles always come from live `goal` so refetches never show a stale task. */
interface ActiveChat {
  phaseIndex: number
  taskIndex: number
}

function PlanLoadingSkeleton({ onBack }: { onBack?: () => void }) {
  const pulse = "animate-pulse motion-reduce:animate-none"
  return (
    <div
      className="h-full min-h-0 flex flex-col bg-background overflow-hidden"
      aria-busy="true"
      aria-label="Loading goal"
    >
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="h-full w-full overflow-y-auto scroll-smooth">
          <div className="px-4 pt-6 pb-24 space-y-6 max-w-4xl mx-auto">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                {onBack ? (
                  <button
                    type="button"
                    onClick={onBack}
                    className="shrink-0 mt-1 p-1 -ml-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Back to goals"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-muted/40" />
                )}
                <div className="flex-1 min-w-0 space-y-2.5 pt-0.5">
                  <div
                    className={`h-8 max-w-[min(92%,18rem)] rounded-lg bg-muted/50 ${pulse}`}
                  />
                  <div className={`h-4 max-w-lg rounded-md bg-muted/35 ${pulse}`} />
                </div>
                <div className={`mt-0.5 h-9 w-9 shrink-0 rounded-full bg-muted/40 ${pulse}`} />
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className={`h-4 w-36 rounded-md bg-muted/45 ${pulse}`} />
                  <div className={`h-4 w-14 rounded-md bg-muted/40 ${pulse}`} />
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted/35 overflow-hidden">
                  <div className={`h-full w-[38%] rounded-full bg-brand/20 ${pulse}`} />
                </div>
                <div className="flex gap-1 flex-1 items-center">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full bg-muted/40 ${pulse}`}
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                  ))}
                  <div className={`h-3 w-8 rounded bg-muted/35 ml-2 shrink-0 ${pulse}`} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {[0, 1].map((phase) => (
                <div
                  key={phase}
                  className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden"
                >
                  <div className="px-5 py-4 flex items-center gap-4 border-b border-border/40">
                    <div className={`h-8 w-8 shrink-0 rounded-full bg-muted/45 ${pulse}`} />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div
                        className={`h-4 max-w-56 rounded-md bg-muted/50 ${pulse}`}
                      />
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <div className="flex-1 h-1 rounded-full bg-muted/30 overflow-hidden">
                          <div className={`h-full w-[55%] rounded-full bg-brand/15 ${pulse}`} />
                        </div>
                      </div>
                    </div>
                    <div className={`h-4 w-4 rounded bg-muted/35 shrink-0 ${pulse}`} />
                  </div>
                  <div className="px-5 py-3 space-y-0 divide-y divide-border/35">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="flex items-start gap-3 py-3 first:pt-2">
                        <div className={`mt-0.5 h-[18px] w-[18px] shrink-0 rounded border border-border/50 bg-muted/25 ${pulse}`} />
                        <div className="flex-1 min-w-0 space-y-2 pt-0.5">
                          <div
                            className={cn(
                              "h-3.5 rounded bg-muted/42 max-w-full",
                              pulse,
                              row === 0 && "w-[88%]",
                              row === 1 && "w-[72%]",
                              row === 2 && "w-[80%]",
                            )}
                          />
                          <div className={`h-3 w-[58%] rounded bg-muted/28 ${pulse}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-[11px] text-muted-foreground/70 pt-2">
              Syncing your plan…
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PlanView({ goalId, onBack }: PlanViewProps) {
  const user = auth.currentUser
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile: userProfile } = useProfileDialog()
  const [updating, setUpdating] = useState(false)
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null)
  const [readingFocusMode, setReadingFocusMode] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [celebrateOpen, setCelebrateOpen] = useState(false)

  useEffect(() => {
    if (!activeChat) setReadingFocusMode(false)
  }, [activeChat])

  const { data: goal, isLoading: loading, error } = useQuery({
    queryKey: ['goal', goalId],
    queryFn: () => (user ? getGoal(user.uid, goalId) : Promise.resolve(null)),
    enabled: !!user && !!goalId,
  })

  useLayoutEffect(() => {
    if (!activeChat || !goal) return
    const phase = goal.phases[activeChat.phaseIndex]
    const task = phase?.tasks[activeChat.taskIndex]
    if (!phase || !task) setActiveChat(null)
  }, [goal, activeChat])

  async function handleTaskToggle(phaseIndex: number, taskIndex: number, completed: boolean) {
    if (!user || !goal) return
    setUpdating(true)
    try {
      const { goalJustCompleted } = await updateTaskCompletion(
        user.uid,
        goalId,
        phaseIndex,
        taskIndex,
        completed,
      )
      if (goalJustCompleted) {
        setCelebrateOpen(true)
      }
      if (completed) {
        const t = goal.phases[phaseIndex]?.tasks[taskIndex]
        if (t) {
          void recordTaskMarkedCompleteInGoalState(
            user.uid,
            goalId,
            goal.title,
            goal.profile,
            phaseIndex,
            taskIndex,
            t.title,
            undefined,
            userProfile,
          )
            .then(() => queryClient.invalidateQueries({ queryKey: ["goal", goalId] }))
            .catch(() => {})
        }
      }
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
    if (!phase || !task) return
    setActiveChat({ phaseIndex, taskIndex })
  }

  if (loading) {
    return <PlanLoadingSkeleton onBack={onBack} />
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
  const journeyComplete = isGoalCompleted(goal)

  const activePhase = activeChat ? goal.phases[activeChat.phaseIndex] : undefined
  const activeTask = activePhase && activeChat ? activePhase.tasks[activeChat.taskIndex] : undefined

  async function handleConfirmDelete() {
    if (!user) return
    setDeleteBusy(true)
    try {
      await deleteGoal(user.uid, goalId)
      await queryClient.removeQueries({ queryKey: ["goal", goalId] })
      await notifyHomeGoalsChanged(user.uid, queryClient)
      setDeleteOpen(false)
      navigate({ to: "/goals" })
    } catch (e) {
      console.error("Failed to delete goal:", e)
    } finally {
      setDeleteBusy(false)
    }
  }

  const planColumnVisible = Boolean(activeChat && !readingFocusMode)

  return (
    <div className="h-full min-h-0 flex flex-col bg-background overflow-hidden">
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Main Plan Area */}
        <div
          className={`h-full overflow-y-auto transition-all duration-300 ease-out scroll-smooth ${
            planColumnVisible
              ? "hidden lg:block lg:w-2/5 lg:max-w-sm xl:max-w-md lg:border-r border-border/60"
              : activeChat
                ? "hidden"
                : "w-full"
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
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="shrink-0 mt-0.5 p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete goal"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {journeyComplete && (
                <div className="rounded-2xl border border-brand/25 bg-linear-to-br from-brand-muted/50 to-transparent px-4 py-3.5 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand/90">
                    Journey complete
                  </p>
                  <p className="text-sm text-foreground/90 leading-snug">
                    This path is closed — not forgotten. Reopen any task to revisit what you learned;
                    your notes and chats stay here as a map you already walked.
                  </p>
                </div>
              )}

              {/* Progress */}
              <div className="bg-card rounded-2xl border p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {journeyComplete ? "You finished every step" : "Overall progress"}
                  </span>
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
        {activeChat && activeTask && activePhase && (
          <div
            className={`flex-1 bg-background relative z-40 lg:z-0 animate-in slide-in-from-right duration-300 h-full overflow-hidden flex flex-col ${
              readingFocusMode ? "lg:items-center" : ""
            }`}
          >
            <div className={`w-full h-full min-h-0 ${readingFocusMode ? "lg:max-w-4xl" : ""}`}>
            <TaskChat
              key={`${goalId}-${activeChat.phaseIndex}-${activeChat.taskIndex}`}
              task={activeTask}
              goalId={goalId}
              goalTitle={goal.title}
              phaseTitle={activePhase.title}
              phaseIndex={activeChat.phaseIndex}
              taskIndex={activeChat.taskIndex}
              goalProfile={goal.profile}
              goalState={goal.goalState}
              onGoalStateUpdated={() =>
                queryClient.invalidateQueries({ queryKey: ["goal", goalId] })
              }
              phaseTasks={activePhase.tasks}
              onClose={() => setActiveChat(null)}
              isDesktopSideView={true}
              readingFocusMode={readingFocusMode}
              onToggleReadingFocus={() => setReadingFocusMode((v) => !v)}
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
          </div>
        )}
      </div>

      <DeleteGoalConfirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        goalTitle={goal.title}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteBusy}
      />

      <GoalCompleteCelebration
        open={celebrateOpen}
        onOpenChange={setCelebrateOpen}
        goalTitle={goal.title}
        onViewGoals={() => navigate({ to: "/goals" })}
      />
    </div>
  )
}

export default PlanView
