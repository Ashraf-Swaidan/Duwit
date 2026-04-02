import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RequireAuth } from '@/components/RequireAuth'
import { auth } from "@/lib/firebase"
import { deleteGoal, getUserGoals, isGoalCompleted, type Goal } from "@/services/goals"
import { notifyHomeGoalsChanged } from "@/services/userContext"
import { Button } from "@/components/ui/button"
import { DeleteGoalConfirm } from "@/components/DeleteGoalConfirm"
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Loader2, Map, Plus, Sparkles, Trash2 } from 'lucide-react'
import { cn } from "@/lib/utils"

export const Route = createFileRoute('/goals')({
  component: GoalsRoutePage,
})

function GoalsRoutePage() {
  return (
    <RequireAuth>
      <GoalsPage />
    </RequireAuth>
  )
}

function goalRecencyMs(g: Goal) {
  return new Date(g.lastActivityAt ?? g.createdAt).getTime()
}

function completedSortMs(g: Goal) {
  if (g.completedAt) return new Date(g.completedAt).getTime()
  return goalRecencyMs(g)
}

const GOALS_PAGE_SIZE = 12
const INITIAL_GOALS_VISIBLE = 12

const goalCardGridClass =
  'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4'

function GoalsPage() {
  const user = auth.currentUser
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [vaultOpen, setVaultOpen] = useState(false)
  const [activeVisible, setActiveVisible] = useState(INITIAL_GOALS_VISIBLE)
  const [completedVisible, setCompletedVisible] = useState(INITIAL_GOALS_VISIBLE)
  const prevVaultOpenRef = useRef(false)

  const { data: goals = [], isPending: goalsLoading } = useQuery({
    queryKey: ['goals', user?.uid],
    queryFn: () => (user ? getUserGoals(user.uid) : Promise.resolve([])),
    enabled: !!user,
  })

  const { activeGoals, completedGoals } = useMemo(() => {
    const active: Goal[] = []
    const done: Goal[] = []
    for (const g of goals) {
      if (isGoalCompleted(g)) done.push(g)
      else active.push(g)
    }
    active.sort((a, b) => goalRecencyMs(b) - goalRecencyMs(a))
    done.sort((a, b) => completedSortMs(b) - completedSortMs(a))
    return { activeGoals: active, completedGoals: done }
  }, [goals])

  useEffect(() => {
    if (activeGoals.length === 0) {
      setActiveVisible(INITIAL_GOALS_VISIBLE)
      return
    }
    setActiveVisible((v) => Math.min(v, activeGoals.length))
  }, [activeGoals.length])

  useEffect(() => {
    if (completedGoals.length === 0) {
      setCompletedVisible(INITIAL_GOALS_VISIBLE)
      return
    }
    setCompletedVisible((v) => Math.min(v, completedGoals.length))
  }, [completedGoals.length])

  useEffect(() => {
    if (prevVaultOpenRef.current && !vaultOpen) {
      setCompletedVisible(INITIAL_GOALS_VISIBLE)
    }
    prevVaultOpenRef.current = vaultOpen
  }, [vaultOpen])

  const activeShown = activeGoals.slice(0, activeVisible)
  const completedShown = completedGoals.slice(0, completedVisible)
  const activeHasMore = activeGoals.length > activeVisible
  const completedHasMore = completedGoals.length > completedVisible

  async function handleConfirmDelete() {
    if (!user || !pendingDelete) return
    setDeleteBusy(true)
    try {
      await deleteGoal(user.uid, pendingDelete.id)
      await queryClient.removeQueries({ queryKey: ['goal', pendingDelete.id] })
      await notifyHomeGoalsChanged(user.uid, queryClient)
      setPendingDelete(null)
    } catch (e) {
      console.error('Failed to delete goal:', e)
    } finally {
      setDeleteBusy(false)
    }
  }

  function renderGoalCard(goal: Goal, variant: 'active' | 'complete') {
    const progress = goal.progress ?? 0
    const totalTasks = goal.phases?.reduce((a, p) => a + p.tasks.length, 0) ?? 0
    const doneTasks =
      goal.phases?.reduce((a, p) => a + p.tasks.filter((t) => t.completed).length, 0) ?? 0
    const isComplete = variant === 'complete'
    const completedLabel = goal.completedAt
      ? new Date(goal.completedAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null

    return (
      <div
        key={goal.id}
        className={cn(
          'relative w-full rounded-3xl border transition-all duration-200 group',
          isComplete
            ? 'bg-muted/20 border-border/60 hover:border-border shadow-none hover:shadow-sm'
            : 'bg-card hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-none',
        )}
      >
        <button
          type="button"
          className="absolute top-3 inset-e-3 z-10 p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label={`Delete ${goal.title}`}
          onClick={() => setPendingDelete({ id: goal.id!, title: goal.title })}
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: '/plan/$goalId', params: { goalId: goal.id! } })}
          className="w-full text-left px-5 py-5 pe-14 rounded-3xl"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3
              className={cn(
                'font-bold text-base leading-snug line-clamp-2 flex-1',
                isComplete && 'text-foreground/85',
              )}
            >
              {goal.title}
            </h3>
            {isComplete ? (
              <span className="shrink-0 text-[0.65rem] font-bold uppercase tracking-wider text-brand/80 mt-1">
                Done
              </span>
            ) : (
              <span className="shrink-0 text-xs font-bold text-muted-foreground mt-0.5">{progress}%</span>
            )}
          </div>

          {goal.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{goal.description}</p>
          )}

          {isComplete ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {completedLabel ? (
                <>You closed this path on {completedLabel}. Open anytime to reread your trail.</>
              ) : (
                <>Every step is marked — your work on this goal is complete.</>
              )}
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {totalTasks > 0 && (
                <p className="text-xs text-muted-foreground">
                  {doneTasks} of {totalTasks} tasks along the way
                </p>
              )}
            </div>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 sm:pr-20 lg:px-8 lg:pr-24 pt-8 pb-24 space-y-6">
      {/* Header — one row on all breakpoints; title + action share the baseline */}
      <div className="flex flex-row items-end justify-between gap-3 sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Your</p>
          <h1 className="text-3xl font-black tracking-tight mt-0.5 leading-none">Goals</h1>
        </div>
        <Button
          onClick={() => navigate({ to: '/new-goal' })}
          className="rounded-full h-9 px-4 sm:px-5 font-semibold gap-1.5 text-sm shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">New Goal</span>
        </Button>
      </div>

      <div className="flex gap-2.5 items-start rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5 sm:px-3.5 sm:py-2 w-full max-w-4xl">
        <Map
          className="h-3.5 w-3.5 shrink-0 text-brand/75 mt-0.5"
          aria-hidden
          strokeWidth={2}
        />
        <div className="min-w-0 text-[11px] sm:text-xs leading-snug text-pretty space-y-0.5">
          <p className="text-foreground/88 font-medium">
            The list below isn’t a chore chart — it’s the terrain ahead.
          </p>
          <p className="text-muted-foreground">
            What’s still open stays up front; finished journeys rest in their own quiet shelf.
          </p>
        </div>
      </div>

      {goalsLoading ? (
        <div className="rounded-3xl border border-border/50 bg-card/40 px-8 py-20 flex flex-col items-center justify-center gap-5 text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-brand/10 blur-xl scale-150" aria-hidden />
            <Loader2 className="relative h-9 w-9 text-brand/70 animate-spin" strokeWidth={1.75} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Loading your goals</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              One moment while we sync your plans.
            </p>
          </div>
        </div>
      ) : goals.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border/70 px-6 py-14 text-center space-y-4">
          <div className="text-5xl">🎯</div>
          <div>
            <h3 className="font-bold text-lg">No goals yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Start a conversation with Duwit on the Home tab, or create a goal directly.
            </p>
          </div>
          <Button onClick={() => navigate({ to: '/new-goal' })} className="rounded-full px-7 h-11 font-semibold">
            Create a Goal
          </Button>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Active — prioritized */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand shrink-0" strokeWidth={2} />
              <h2 className="text-lg font-bold tracking-tight">What you’re still walking</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-2 max-w-2xl leading-relaxed">
              These are the threads that still want your attention — ordered by what you touched most
              recently.
            </p>
            {activeGoals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Nothing in motion right now. When you add a goal, it will land here — or open the
                  shelf below to revisit a path you already finished.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={goalCardGridClass}>
                  {activeShown.map((g) => renderGoalCard(g, 'active'))}
                </div>
                {activeHasMore && (
                  <div className="flex justify-center pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-full px-6"
                      onClick={() =>
                        setActiveVisible((v) =>
                          Math.min(v + GOALS_PAGE_SIZE, activeGoals.length),
                        )
                      }
                    >
                      Show {Math.min(GOALS_PAGE_SIZE, activeGoals.length - activeVisible)} more
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Completed — collapsed vault */}
          {completedGoals.length > 0 && (
            <section className="space-y-3">
              <button
                type="button"
                onClick={() => setVaultOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/15 px-4 py-3.5 text-start hover:bg-muted/25 transition-colors"
                aria-expanded={vaultOpen}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground/90">Paths you’ve walked</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {completedGoals.length}{' '}
                    {completedGoals.length === 1 ? 'journey' : 'journeys'} complete — kept here so
                    they don’t crowd what’s next.
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200',
                    vaultOpen && 'rotate-180',
                  )}
                />
              </button>

              {vaultOpen && (
                <div className="space-y-3 ps-1 border-s-2 border-brand/20 ms-3 py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground ps-4">
                    Archive of finished work — tap to reopen the full plan
                  </p>
                  <div className={goalCardGridClass}>
                    {completedShown.map((g) => renderGoalCard(g, 'complete'))}
                  </div>
                  {completedHasMore && (
                    <div className="flex justify-center pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        className="rounded-full px-6"
                        onClick={() =>
                          setCompletedVisible((v) =>
                            Math.min(v + GOALS_PAGE_SIZE, completedGoals.length),
                          )
                        }
                      >
                        Show{' '}
                        {Math.min(GOALS_PAGE_SIZE, completedGoals.length - completedVisible)} more
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <DeleteGoalConfirm
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        goalTitle={pendingDelete?.title ?? ''}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteBusy}
      />
    </div>
  )
}
