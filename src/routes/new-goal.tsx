import { createFileRoute, useNavigate } from '@tanstack/react-router'
import GoalChat from '@/pages/GoalChat'

export const Route = createFileRoute('/new-goal')({
  component: NewGoalPage,
})

function NewGoalPage() {
  const navigate = useNavigate()

  return (
    <GoalChat
      onSuccess={(goalId) => {
        navigate({ to: '/plan/$goalId', params: { goalId } })
      }}
      onBack={() => navigate({ to: '/' })}
    />
  )
}
