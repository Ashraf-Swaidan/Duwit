import { useState } from "react"
import { ArrowLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/firebase"
import { callAIStructured } from "@/services/ai"
import { generatePlanPrompt, PLAN_GENERATION_SYSTEM_PROMPT } from "@/services/prompts"
import { createGoal, type Goal } from "@/services/goals"
import { expandCurriculumForPlan } from "@/services/curriculumExpansion"
import { useModel } from "@/contexts/ModelContext"
import { formatUserProfileForPrompt } from "@/services/user"
import { useProfileDialog } from "@/contexts/ProfileDialogContext"

interface NewGoalProps {
  onSuccess?: (goalId: string) => void
  onBack?: () => void
}

const TIME_OPTIONS = [
  { label: "15 min", value: "15 minutes" },
  { label: "30 min", value: "30 minutes" },
  { label: "1 hour", value: "1 hour" },
  { label: "2 hours", value: "2 hours" },
  { label: "3+ hours", value: "3+ hours" },
]

export function NewGoal({ onSuccess, onBack }: NewGoalProps) {
  const user = auth.currentUser
  const { selectedModel } = useModel()
  const { profile: userProfile } = useProfileDialog()

  const [goal, setGoal] = useState("")
  const [timePerDay, setTimePerDay] = useState("30 minutes")
  const [loading, setLoading] = useState(false)
  const [planStage, setPlanStage] = useState<"outline" | "lessons" | null>(null)
  const [lessonProgress, setLessonProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!goal.trim()) {
      setError("Tell us what you want to achieve first.")
      return
    }
    if (!user) {
      setError("You must be logged in")
      return
    }

    setLoading(true)
    setPlanStage("outline")
    setError(null)

    let stage: "outline" | "lessons" = "outline"
    try {
      const prompt = generatePlanPrompt(goal, timePerDay)
      const planBlock = formatUserProfileForPrompt(userProfile)
      const planSystemPrompt = planBlock
        ? `${PLAN_GENERATION_SYSTEM_PROMPT}\n\n${planBlock}`
        : PLAN_GENERATION_SYSTEM_PROMPT
      const plan = await callAIStructured<Omit<Goal, "id" | "uid" | "status" | "createdAt" | "progress">>({
        prompt,
        systemPrompt: planSystemPrompt,
        temperature: 0.2,
        maxOutputTokens: 5000,
        modelName: selectedModel,
      })

      const skeleton = plan as Goal
      stage = "lessons"
      setPlanStage("lessons")
      const expanded = await expandCurriculumForPlan(skeleton, selectedModel, (done, total) => {
        setLessonProgress({ done, total })
      })

      const goalId = await createGoal(user.uid, expanded)
      onSuccess?.(goalId)
      setGoal("")
    } catch (e) {
      setError(
        stage === "lessons"
          ? "Couldn't generate lessons for one part of your plan. Try again or shorten the goal."
          : e instanceof Error
            ? e.message
            : "Failed to generate plan. Please try again.",
      )
      console.error("Plan generation error:", e)
    } finally {
      setLoading(false)
      setPlanStage(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto min-h-[calc(100svh-3.5rem)] flex flex-col px-4 pt-6 pb-8">
      {/* Back nav */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 -ml-1 w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      )}

      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight leading-tight">
          What do you want<br />to achieve?
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Be specific — the more detail, the better your plan.
        </p>
      </div>

      {/* Goal textarea */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="flex-1">
          <textarea
            className="w-full h-full min-h-[180px] rounded-2xl border bg-card px-5 py-4 text-base leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none transition-all"
            placeholder="e.g., Learn conversational Spanish so I can travel to Mexico comfortably…"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={loading}
            autoFocus
          />
        </div>

        {/* Time commitment */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">How much time can you commit daily?</p>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimePerDay(opt.value)}
                disabled={loading}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-150 ${
                  timePerDay === opt.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-destructive/10 border border-destructive/20 px-4 py-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={loading || !goal.trim()}
          className="w-full h-12 rounded-2xl text-sm font-bold gap-2"
        >
          {loading ? (
            <>
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
              </div>
              {planStage === "lessons" && lessonProgress.total > 0
                ? `Detailing lessons (${lessonProgress.done}/${lessonProgress.total})…`
                : "Outlining roadmap…"}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate My Plan
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          AI will create a structured plan with phases and tasks tailored to your schedule.
        </p>
      </div>
    </div>
  )
}

export default NewGoal
