import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { auth } from "@/lib/firebase"
import { deleteGoal, getUserGoals } from "@/services/goals"
import { notifyHomeGoalsChanged } from "@/services/userContext"
import { Button } from "@/components/ui/button"
import { DeleteGoalConfirm } from "@/components/DeleteGoalConfirm"
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'

export const Route = createFileRoute('/goals')({
  component: GoalsPage,
})

function GoalsPage() {
  const user = auth.currentUser
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const { data: goals = [], isPending: goalsLoading } = useQuery({
    queryKey: ['goals', user?.uid],
    queryFn: () => (user ? getUserGoals(user.uid) : Promise.resolve([])),
    enabled: !!user,
  })

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

  return (
    <div className="max-w-4xl mx-auto px-4 pt-8 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Your</p>
          <h1 className="text-3xl font-black tracking-tight mt-0.5">Goals</h1>
        </div>
        <Button
          onClick={() => navigate({ to: '/new-goal' })}
          className="rounded-full px-5 h-9 font-semibold gap-1.5 text-sm"
        >
          <Plus className="h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Goals list */}
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
        <div className="space-y-3">
          {goals.map((goal) => {
            const progress = goal.progress ?? 0
            const totalTasks = goal.phases?.reduce((a, p) => a + p.tasks.length, 0) ?? 0
            const doneTasks =
              goal.phases?.reduce((a, p) => a + p.tasks.filter((t) => t.completed).length, 0) ?? 0

            return (
              <div
                key={goal.id}
                className="relative w-full rounded-3xl border bg-card hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all duration-200 group"
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
                    <h3 className="font-bold text-base leading-snug line-clamp-2 flex-1">{goal.title}</h3>
                    <span className="shrink-0 text-xs font-bold text-muted-foreground mt-0.5">{progress}%</span>
                  </div>

                  {goal.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{goal.description}</p>
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
              </div>
            )
          })}
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
