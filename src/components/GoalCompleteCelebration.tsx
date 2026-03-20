import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface GoalCompleteCelebrationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalTitle: string
  onViewGoals?: () => void
}

export function GoalCompleteCelebration({
  open,
  onOpenChange,
  goalTitle,
  onViewGoals,
}: GoalCompleteCelebrationProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="sm:max-w-md overflow-hidden border-brand/20 bg-linear-to-b from-brand-muted/40 via-background to-background p-0 gap-0"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-24 start-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-brand/15 blur-3xl motion-safe:animate-pulse" />
          <div className="absolute top-12 end-4 text-2xl text-brand/30 motion-safe:animate-[celebrate-float_4s_ease-in-out_infinite]">
            ✦
          </div>
          <div className="absolute top-20 start-6 text-lg text-brand/25 motion-safe:animate-[celebrate-float_5s_ease-in-out_infinite_0.5s]">
            ✧
          </div>
        </div>
        <style>{`
          @keyframes celebrate-float {
            0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.35; }
            50% { transform: translateY(-6px) rotate(12deg); opacity: 0.7; }
          }
        `}</style>

        <div className="relative px-6 pt-10 pb-2 text-center sm:text-start space-y-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-brand/80">
            Milestone
          </p>
          <DialogHeader className="gap-2 text-center sm:text-start space-y-0">
            <DialogTitle className="text-2xl font-black tracking-tight leading-tight pe-8">
              You walked the whole path
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-3 pt-1">
                <p>
                  <span className="font-medium text-foreground/90">“{goalTitle}”</span> is fully marked
                  complete — quizzes, tasks, and the quiet work in between count.
                </p>
                <p className="text-foreground/85 italic border-s-2 border-brand/40 ps-3">
                  Progress here was never about ticking boxes. It was about showing up for each step.
                  Pause here if you like; when you’re ready, there’s always another trail.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
        </div>

        <DialogFooter className="relative px-6 pb-6 pt-4 flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full rounded-full font-semibold h-11"
            onClick={() => onOpenChange(false)}
          >
            Stay with this goal
          </Button>
          {onViewGoals && (
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => {
                onOpenChange(false)
                onViewGoals()
              }}
            >
              See all goals
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
