import type { Task } from "@/services/goals"

interface TaskItemProps {
  task: Task
  phaseIndex: number
  taskIndex: number
  goalId: string
  goalTitle: string
  phaseTitle: string
  onToggle: (phaseIndex: number, taskIndex: number, completed: boolean) => void
  onOpenGuide: (phaseIndex: number, taskIndex: number) => void
  loading?: boolean
  isActive?: boolean
}

const typeConfig: Record<Task["type"], { label: string; classes: string }> = {
  learn:    { label: "learn",    classes: "bg-blue-100   text-blue-700   dark:bg-blue-900/40  dark:text-blue-300"   },
  build:    { label: "build",    classes: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  practice: { label: "practice", classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  project:  { label: "project",  classes: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"  },
  review:   { label: "review",   classes: "bg-slate-100  text-slate-600   dark:bg-slate-800    dark:text-slate-300"   },
}

export function TaskItem({
  task,
  phaseIndex,
  taskIndex,
  onToggle,
  onOpenGuide,
  loading,
  isActive,
}: TaskItemProps) {
  const type = typeConfig[task.type] ?? typeConfig.learn

  return (
    <div
      className={`rounded-xl px-3 py-3 flex items-start gap-3 transition-all group border-2 ${
        isActive 
          ? "bg-brand/5 border-brand/20" 
          : "border-transparent " + (task.completed ? "opacity-60" : "hover:bg-muted/60 cursor-pointer active:scale-[0.98]")
      }`}
      onClick={(e) => {
        // Don't open guide if clicking the checkbox button
        if ((e.target as HTMLElement).closest('button[role="checkbox"]')) return;
        onOpenGuide(phaseIndex, taskIndex);
      }}
    >
      {/* Custom checkbox */}
      <button
        role="checkbox"
        aria-checked={task.completed}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(phaseIndex, taskIndex, !task.completed);
        }}
        disabled={loading}
        className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
          task.completed
            ? "bg-brand border-brand"
            : "border-muted-foreground/40 hover:border-brand"
        }`}
      >
        {task.completed && (
          <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 text-brand-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1,4 3.5,6.5 9,1" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-0.5">
          <span
            className={`text-sm font-medium leading-snug flex-1 ${
              task.completed ? "line-through text-muted-foreground" : ""
            }`}
          >
            {task.title}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${type.classes}`}>
            {type.label}
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{task.description}</p>

          <span className="text-xs text-muted-foreground">
            {task.estimatedDays} {task.estimatedDays === 1 ? "day" : "days"}
            {task.completedAt && (
              <span className="ml-2 text-brand font-medium">
                · done {new Date(task.completedAt).toLocaleDateString()}
              </span>
            )}
          </span>
      </div>
    </div>
  )
}
