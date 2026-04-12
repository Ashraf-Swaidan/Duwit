import { useState, useRef, useEffect } from "react"
import { ArrowLeft, Send, Zap, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/firebase"
import {
  callAIStream,
  callAIStructured,
  isVertexRateLimitError,
  VERTEX_RATE_LIMIT_USER_MESSAGE,
} from "@/services/ai"
import {
  GOAL_CHAT_SYSTEM_PROMPT,
  PLAN_READY_MARKER,
  generatePlanFromChatPrompt,
  PLAN_GENERATION_SYSTEM_PROMPT,
  generateGoalProfilePrompt,
} from "@/services/prompts"
import { createGoal, type Goal, type ChatMessage, type GoalProfile } from "@/services/goals"
import { expandCurriculumForPlan } from "@/services/curriculumExpansion"
import { useModel } from "@/contexts/ModelContext"
import { formatUserProfileForPrompt } from "@/services/user"
import { useProfileDialog } from "@/contexts/ProfileDialogContext"
import { Markdown } from "@/components/Markdown"

interface GoalChatProps {
  onSuccess: (goalId: string) => void
  onBack: () => void
}

const OPENER: ChatMessage = {
  role: "assistant",
  content:
    "What do you want to achieve? Tell me your goal or idea — even rough is fine — and I'll ask a few questions to build the best plan for you.",
}

export function GoalChat({ onSuccess, onBack }: GoalChatProps) {
  const { selectedModel } = useModel()
  const user = auth.currentUser

  const [messages, setMessages] = useState<ChatMessage[]>([OPENER])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [planReady, setPlanReady] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState<"roadmap" | "lessons">("roadmap")
  const [lessonProgress, setLessonProgress] = useState({ done: 0, total: 0 })
  const [genError, setGenError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { profile: userProfile } = useProfileDialog()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }))
  }, [messages, sending])

  function cleanStreamText(raw: string): string {
    let clean = raw.replace(/^\s*<\s*coach\s*>/i, "").trim()
    clean = clean.replace(/<\/coach>[\s\S]*$/, "").trim()
    const cutPatterns = [/<user>/i, /<\s*coach\s*>/i, /\nUser:/i, /\nMe:/i]
    for (const pat of cutPatterns) {
      const idx = clean.search(pat)
      if (idx !== -1) clean = clean.slice(0, idx).trim()
    }
    return clean.replaceAll(PLAN_READY_MARKER, "").trim()
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending || generating) return

    const userMsg: ChatMessage = { role: "user", content: trimmed }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput("")
    setSending(true)
    if (inputRef.current) inputRef.current.style.height = "auto"

    try {
      const history =
        updated
          .map((m) =>
            m.role === "user"
              ? `<user>${m.content}</user>`
              : `<coach>${m.content}</coach>`,
          )
          .join("\n") +
        "\n\nWrite the coach's next message below as plain text only (do not use <coach> or XML tags)."

      const profileBlock = formatUserProfileForPrompt(userProfile)
      const systemPrompt = profileBlock
        ? `${GOAL_CHAT_SYSTEM_PROMPT}\n\n${profileBlock}`
        : GOAL_CHAT_SYSTEM_PROMPT

      // Streaming placeholder
      setMessages([...updated, { role: "assistant", content: "" }])

      let accumulated = ""
      const { text: response } = await callAIStream({
        prompt: history,
        systemPrompt,
        temperature: 0.8,
        maxOutputTokens: 350,
        modelName: selectedModel,
        onChunk: (piece) => {
          accumulated += piece
          setMessages([...updated, { role: "assistant", content: cleanStreamText(accumulated) }])
        },
      })

      const isReady = response.includes(PLAN_READY_MARKER)
      setMessages([...updated, { role: "assistant", content: cleanStreamText(response) }])
      if (isReady) setPlanReady(true)
    } catch (err) {
      const fallback = "Sorry, I had trouble responding. Please try again."
      const content = isVertexRateLimitError(err) ? VERTEX_RATE_LIMIT_USER_MESSAGE : fallback
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === "assistant" && last.content === "") {
          next[next.length - 1] = { role: "assistant", content }
          return next
        }
        return [...next, { role: "assistant", content }]
      })
    } finally {
      setSending(false)
    }
  }

  async function handleGeneratePlan() {
    if (!user || generating) return
    setGenerating(true)
    setGenerationStep("roadmap")
    setGenError(null)

    let step: "roadmap" | "lessons" = "roadmap"
    try {
      // 1) Build the plan from the conversation
      const planPrompt = generatePlanFromChatPrompt(messages)
      const planProfileBlock = formatUserProfileForPrompt(userProfile)
      const planSystemPrompt = planProfileBlock
        ? `${PLAN_GENERATION_SYSTEM_PROMPT}\n\n${planProfileBlock}`
        : PLAN_GENERATION_SYSTEM_PROMPT

      const plan = await callAIStructured<
        Omit<Goal, "id" | "uid" | "status" | "createdAt" | "progress">
      >({
        prompt: planPrompt,
        systemPrompt: planSystemPrompt,
        temperature: 0.2,
        maxOutputTokens: 5000,
        modelName: selectedModel,
      })

      // 2) Distill a reusable per-goal profile (\"memory\") from the same conversation
      const profilePrompt = generateGoalProfilePrompt(messages)
      let profile: GoalProfile | undefined
      const profileSysBlock = formatUserProfileForPrompt(userProfile)
      const profileSystemPrompt = profileSysBlock
        ? `You extract JSON only for a per-goal coach profile. No markdown, no commentary.\n\n${profileSysBlock}`
        : `You extract JSON only for a per-goal coach profile. No markdown, no commentary.`
      try {
        profile = await callAIStructured<GoalProfile>({
          prompt: profilePrompt,
          systemPrompt: profileSystemPrompt,
          temperature: 0.1,
          maxOutputTokens: 600,
          modelName: selectedModel,
        })
      } catch {
        profile = undefined
      }

      const skeleton: Goal = {
        ...(plan as Goal),
        profile,
      }

      step = "lessons"
      setGenerationStep("lessons")
      const expanded = await expandCurriculumForPlan(
        skeleton,
        selectedModel,
        (done, total) => {
          setLessonProgress({ done, total })
        },
        { userProfile, goalProfile: profile },
      )

      const goalId = await createGoal(user.uid, expanded)
      onSuccess(goalId)
    } catch (e) {
      console.error("Plan generation error:", e)
      if (isVertexRateLimitError(e)) {
        setGenError(VERTEX_RATE_LIMIT_USER_MESSAGE)
      } else {
        setGenError(
          step === "lessons"
            ? "Couldn't generate lessons for one part of your plan. Try again or shorten the goal."
            : "Couldn't generate the plan. Please try again.",
        )
      }
      setGenerating(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ── Generating screen ──────────────────────────────────────────────────────
  if (generating) {
    return (
      <div className="h-full min-h-0 flex flex-col items-center justify-center gap-5 px-4">
        <div className="relative">
          <div className="h-20 w-20 rounded-full bg-brand/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-brand" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-brand/20 animate-ping" />
        </div>
        <div className="text-center space-y-1.5">
          <h2 className="font-bold text-xl">
            {generationStep === "lessons" && lessonProgress.total > 0
              ? `Detailing lessons (${lessonProgress.done}/${lessonProgress.total})…`
              : "Outlining roadmap…"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            {generationStep === "lessons"
              ? "Generating the lesson steps each task will follow."
              : "Crafting a personalized roadmap based on everything we discussed."}
          </p>
        </div>
        <div className="flex gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-brand/60 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-brand/60 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-brand/60 animate-bounce" />
        </div>
      </div>
    )
  }

  // ── Chat screen ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 w-full pb-[calc(env(safe-area-inset-bottom)+4.25rem)] sm:pb-0">
      {/* Message thread */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-6 pb-32"
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Back nav */}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {messages.map((msg, i) => {
            const isRtl = /[\u0600-\u06FF]/.test(msg.content)
            const isStreamingShell =
              msg.role === "assistant" &&
              msg.content === "" &&
              sending &&
              i === messages.length - 1
            return (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center mr-3 mt-0.5 shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-brand" />
                  </div>
                )}
                {msg.role === "assistant" ? (
                  <div
                    dir={isRtl ? "rtl" : "ltr"}
                    className={`flex-1 text-sm leading-7 text-foreground py-0.5 ${isRtl ? "text-right" : ""}`}
                    style={{ wordBreak: "break-word" }}
                  >
                    {isStreamingShell ? (
                      <div className="flex items-center gap-1.5 py-2" aria-hidden>
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" />
                      </div>
                    ) : (
                      <Markdown content={msg.content} className={isRtl ? "text-right" : undefined} />
                    )}
                  </div>
                ) : (
                  <div
                    dir={isRtl ? "rtl" : "ltr"}
                    className={`max-w-[min(82%,28rem)] rounded-[1.25rem] px-4 py-2.5 text-sm leading-relaxed bg-primary text-primary-foreground ${isRtl ? "text-right" : "text-left"}`}
                    style={{ wordBreak: "break-word" }}
                  >
                    <span className="whitespace-pre-wrap block">{msg.content}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Plan-ready banner */}
      {planReady && (
        <div data-tour-id="goal-build-plan" className="shrink-0 w-full max-w-2xl mx-auto px-4 mb-2">
          <div className="rounded-2xl bg-brand/8 border border-brand/20 px-4 py-3.5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold leading-snug">Ready to build your plan</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You can keep chatting to refine, or generate now.
              </p>
            </div>
            <Button
              onClick={handleGeneratePlan}
              disabled={generating}
              className="shrink-0 rounded-xl gap-1.5 font-bold h-9 px-4 text-sm"
            >
              <Zap className="h-3.5 w-3.5" />
              Build Plan
            </Button>
          </div>
          {genError && (
            <p className="text-xs text-destructive mt-2 px-1">{genError}</p>
          )}
        </div>
      )}

      {/* Floating input */}
      <div className="sticky bottom-0 px-4 pb-5 pt-2 bg-linear-to-t from-background via-background/95 to-transparent">
        <div className="w-full max-w-2xl mx-auto">
            <div data-tour-id="goal-chat-input" className="flex items-end gap-2 rounded-3xl border border-border/70 bg-card/95 backdrop-blur-md shadow-lg shadow-black/5 px-3.5 py-2.5 focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/15 transition-all">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = "auto"
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
              }}
              onKeyDown={handleKeyDown}
              placeholder={planReady ? "Add more context or build the plan…" : "Tell me your goal…"}
              disabled={sending || generating}
              className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60 disabled:opacity-50 leading-relaxed py-1"
              style={{ minHeight: "24px", maxHeight: "120px", overflowY: "auto" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || sending || generating}
              className="shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-30 disabled:pointer-events-none shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GoalChat
