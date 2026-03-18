import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { auth } from "@/lib/firebase"
import { getUserGoals } from "@/services/goals"
import { Button } from "@/components/ui/button"
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

export const Route = createFileRoute('/goals')({
  component: GoalsPage,
})

function GoalsPage() {
  const user = auth.currentUser
  const navigate = useNavigate()

  const { data: goals = [], isPending: goalsLoading } = useQuery({
    queryKey: ['goals', user?.uid],
    queryFn: () => (user ? getUserGoals(user.uid) : Promise.resolve([])),
    enabled: !!user,
  })

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
              <button
                key={goal.id}
                onClick={() => navigate({ to: '/plan/$goalId', params: { goalId: goal.id! } })}
                className="w-full text-left rounded-3xl border bg-card px-5 py-5 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all duration-200 group"
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
            )
          })}
        </div>
      )}
    </div>
  )
}
