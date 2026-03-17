import { useState } from "react"
import { ChevronDown, CheckCircle2 } from "lucide-react"
import type { Phase } from "@/services/goals"
import { TaskItem } from "./TaskItem"

interface PhaseCardProps {
  phase: Phase
  phaseIndex: number
  goalId: string
  goalTitle: string
  onTaskToggle: (phaseIndex: number, taskIndex: number, completed: boolean) => void
  onOpenGuide: (phaseIndex: number, taskIndex: number) => void
  loading?: boolean
}

export function PhaseCard({
  phase,
  phaseIndex,
  goalId,
  goalTitle,
  onTaskToggle,
  onOpenGuide,
  loading,
}: PhaseCardProps) {
  const [isOpen, setIsOpen] = useState(phaseIndex === 0)

  const total = phase.tasks.length
  const done = phase.tasks.filter((t) => t.completed).length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0
  const isComplete = done === total && total > 0

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
        isComplete ? "border-border/50 bg-muted/20" : "bg-card"
      }`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors text-left"
      >
        {/* Phase number / complete badge */}
        <div
          className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
            isComplete
              ? "bg-brand/15 text-brand"
              : done > 0
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {isComplete ? <CheckCircle2 className="h-4 w-4" /> : phaseIndex + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3
              className={`font-bold text-sm leading-snug ${isComplete ? "text-muted-foreground" : ""}`}
            >
              {phase.title}
            </h3>
          </div>

          {/* Inline mini progress */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {done}/{total}
            </span>
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-border/60 bg-background/40 px-4 py-3 space-y-1">
          {phase.description && (
            <p className="text-xs text-muted-foreground px-1 pb-2">{phase.description}</p>
          )}
          {phase.tasks.map((task, taskIndex) => (
            <TaskItem
              key={taskIndex}
              task={task}
              phaseIndex={phaseIndex}
              taskIndex={taskIndex}
              goalId={goalId}
              goalTitle={goalTitle}
              phaseTitle={phase.title}
              onToggle={onTaskToggle}
              onOpenGuide={onOpenGuide}
              loading={loading}
            />
          ))}
        </div>
      )}
    </div>
  )
}
