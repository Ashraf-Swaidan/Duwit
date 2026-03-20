import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { RequireAuth } from '@/components/RequireAuth'
import PlanView from '@/pages/PlanView'

export const Route = createFileRoute('/plan/$goalId')({
  component: PlanRoutePage,
})

function PlanRoutePage() {
  const { goalId } = useParams({ from: '/plan/$goalId' })
  const navigate = useNavigate()

  return (
    <RequireAuth>
      <PlanView
        goalId={goalId}
        onBack={() => navigate({ to: '/goals' })}
      />
    </RequireAuth>
  )
}
