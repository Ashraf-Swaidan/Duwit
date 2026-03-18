import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import PlanView from '@/pages/PlanView'

export const Route = createFileRoute('/plan/$goalId')({
  component: PlanPage,
})

function PlanPage() {
  const { goalId } = useParams({ from: '/plan/$goalId' })
  const navigate = useNavigate()

  return (
    <PlanView
      goalId={goalId}
      onBack={() => navigate({ to: '/' })}
    />
  )
}
