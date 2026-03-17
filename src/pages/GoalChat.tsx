import { useState, useRef, useEffect } from "react"
import { ArrowLeft, Send, Zap, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/firebase"
import { callAI, callAIStructured } from "@/services/ai"
import {
  GOAL_CHAT_SYSTEM_PROMPT,
  PLAN_READY_MARKER,
  generatePlanFromChatPrompt,
  PLAN_GENERATION_SYSTEM_PROMPT,
} from "@/services/prompts"
import { createGoal, type Goal, type ChatMessage } from "@/services/goals"
import { useModel } from "@/contexts/ModelContext"
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
  const [genError, setGenError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }))
  }, [messages, sending])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending || generating) return

    const userMsg: ChatMessage = { role: "user", content: trimmed }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput("")
    setSending(true)
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
    }

    try {
      const history = updated
        .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`)
        .join("\n\n")

      const raw = await callAI({
        prompt: history,
        systemPrompt: GOAL_CHAT_SYSTEM_PROMPT,
        temperature: 0.8,
        maxOutputTokens: 350,
        modelName: selectedModel,
      })

      const isReady = raw.includes(PLAN_READY_MARKER)
      const content = raw.replaceAll(PLAN_READY_MARKER, "").trim()

      setMessages([...updated, { role: "assistant", content }])
      if (isReady) setPlanReady(true)
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I had trouble responding. Please try again." },
      ])
    } finally {
      setSending(false)
    }
  }

  async function handleGeneratePlan() {
    if (!user || generating) return
    setGenerating(true)
    setGenError(null)

    try {
      const prompt = generatePlanFromChatPrompt(messages)
      const plan = await callAIStructured<
        Omit<Goal, "id" | "uid" | "status" | "createdAt" | "progress">
      >({
        prompt,
        systemPrompt: PLAN_GENERATION_SYSTEM_PROMPT,
        temperature: 0.2,
        maxOutputTokens: 5000,
        modelName: selectedModel,
      })
      const goalId = await createGoal(user.uid, plan as Goal)
      onSuccess(goalId)
    } catch (e) {
      console.error("Plan generation error:", e)
      setGenError("Couldn't generate the plan. Please try again.")
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
      <div className="min-h-[calc(100svh-3.5rem)] flex flex-col items-center justify-center gap-5 px-4">
        <div className="relative">
          <div className="h-20 w-20 rounded-full bg-brand/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-brand" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-brand/20 animate-ping" />
        </div>
        <div className="text-center space-y-1.5">
          <h2 className="font-bold text-xl">Building your plan…</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Crafting a personalized roadmap based on everything we discussed.
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
    <div className="flex flex-col h-[calc(100svh-3.5rem)]">
      {/* Back nav */}
      <div className="shrink-0 px-4 pt-5 pb-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* Message thread */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-1 duration-200`}
          >
            {msg.role === "assistant" && (
              <div className="h-6 w-6 rounded-full bg-brand/15 flex items-center justify-center mr-2 mt-1 shrink-0">
                <Sparkles className="h-3 w-3 text-brand" />
              </div>
            )}
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <Markdown content={msg.content} />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex justify-start animate-in fade-in duration-150">
            <div className="h-6 w-6 rounded-full bg-brand/15 flex items-center justify-center mr-2 mt-1 shrink-0">
              <Sparkles className="h-3 w-3 text-brand" />
            </div>
            <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Plan-ready banner — appears when AI signals it has enough context */}
      {planReady && (
        <div className="shrink-0 mx-4 mb-3">
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

      {/* Input bar */}
      <div className="shrink-0 border-t border-border/60 bg-background px-4 py-3">
        <div className="flex gap-2 items-end">
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
            className="flex-1 resize-none rounded-2xl border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all placeholder:text-muted-foreground/60 disabled:opacity-50 leading-relaxed"
            style={{ minHeight: "42px", maxHeight: "120px", overflowY: "auto" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending || generating}
            className="h-[42px] w-[42px] shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-30 disabled:pointer-events-none"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default GoalChat
