import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RequireAuth } from '@/components/RequireAuth'
import GoalChat from '@/pages/GoalChat'

export const Route = createFileRoute('/new-goal')({
  component: NewGoalRoutePage,
})

function NewGoalRoutePage() {
  const navigate = useNavigate()

  return (
    <RequireAuth>
      <GoalChat
        onSuccess={(goalId) => {
          navigate({ to: '/plan/$goalId', params: { goalId } })
        }}
        onBack={() => navigate({ to: '/app' })}
      />
    </RequireAuth>
  )
}
