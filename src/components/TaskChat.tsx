import { useState, useRef, useEffect } from "react"
import { ArrowLeft, Send, Sparkles } from "lucide-react"
import type { Task, ChatMessage, GoalProfile } from "@/services/goals"
import { saveTaskChat, loadTaskChat } from "@/services/goals"
import { auth } from "@/lib/firebase"
import { callAI } from "@/services/ai"
import { generateTaskGuideSystemPrompt, generateTaskSuggestedPrompt } from "@/services/prompts"
import { useModel } from "@/contexts/ModelContext"
import { Markdown } from "@/components/Markdown"
import { getUserProfile, type UserProfile } from "@/services/user"

interface TaskChatProps {
  task: Task
  goalId: string
  goalTitle: string
  phaseTitle: string
  phaseIndex: number
  taskIndex: number
  onClose: () => void
  goalProfile?: GoalProfile
  phaseTasks: Task[]
}

function scrollToBottom(el: HTMLDivElement | null, smooth = true) {
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" })
}

export function TaskChat({
  task,
  goalId,
  goalTitle,
  phaseTitle,
  phaseIndex,
  taskIndex,
  onClose,
  goalProfile,
  phaseTasks,
}: TaskChatProps) {
  const { selectedModel } = useModel()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [youtubeMeta, setYoutubeMeta] = useState<Record<number, { youtubeSearches: string[]; channels: string[] }>>({})
  const [input, setInput] = useState("")
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [sending, setSending] = useState(false)
  const [suggestedPrompt] = useState(() => generateTaskSuggestedPrompt(task))
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const prevLengthRef = useRef(0)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  function parseDuwitPayload(text: string): {
    clean: string
    meta?: { youtubeSearches: string[]; channels: string[] }
  } {
    const match = text.match(/```duwit\s*([\s\S]*?)\s*```/i)
    if (!match?.[1]) return { clean: text }
    try {
      const obj = JSON.parse(match[1]) as Partial<{ youtubeSearches: unknown; channels: unknown }>
      const youtubeSearches = Array.isArray(obj.youtubeSearches)
        ? obj.youtubeSearches.filter((x): x is string => typeof x === "string").slice(0, 8)
        : []
      const channels = Array.isArray(obj.channels)
        ? obj.channels.filter((x): x is string => typeof x === "string").slice(0, 8)
        : []
      const clean = text.replace(match[0], "").trim()
      if (youtubeSearches.length === 0 && channels.length === 0) return { clean }
      return { clean, meta: { youtubeSearches, channels } }
    } catch {
      return { clean: text }
    }
  }

  function youtubeSearchUrl(q: string) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
  }

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    getUserProfile(uid).then(setUserProfile).catch(() => setUserProfile(null))
  }, [])

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) { setLoadingHistory(false); return }
    loadTaskChat(uid, goalId, phaseIndex, taskIndex)
      .then((saved) => {
        // Parse any embedded payloads (future-proof)
        const nextMeta: Record<number, { youtubeSearches: string[]; channels: string[] }> = {}
        const cleaned = saved.map((m, idx) => {
          if (m.role !== "assistant") return m
          const parsed = parseDuwitPayload(m.content)
          if (parsed.meta) nextMeta[idx] = parsed.meta
          return { ...m, content: parsed.clean }
        })
        setYoutubeMeta(nextMeta)
        setMessages(cleaned)
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [goalId, phaseIndex, taskIndex])

  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      requestAnimationFrame(() => scrollToBottom(scrollRef.current))
    }
    prevLengthRef.current = messages.length
  }, [messages])

  useEffect(() => {
    if (!loadingHistory) {
      requestAnimationFrame(() => scrollToBottom(scrollRef.current, false))
      inputRef.current?.focus()
    }
  }, [loadingHistory])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const uid = auth.currentUser?.uid
    const userMsg: ChatMessage = { role: "user", content: trimmed }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput("")
    setSending(true)

    try {
      let systemPrompt = generateTaskGuideSystemPrompt(goalTitle, phaseTitle, task)

      // Enrich system prompt with global user profile and per-goal profile + phase context
      const lines: string[] = []
      if (userProfile && (userProfile.nickname || userProfile.preferredLanguage || userProfile.preferredLearningStyle)) {
        lines.push("User profile:")
        if (userProfile.nickname) lines.push(`- Nickname: ${userProfile.nickname}`)
        if (userProfile.preferredLanguage) lines.push(`- Preferred language: ${userProfile.preferredLanguage}`)
        if (userProfile.preferredLearningStyle)
          lines.push(`- Learning style: ${userProfile.preferredLearningStyle}`)
        if (userProfile.preferredTone) lines.push(`- Tone: ${userProfile.preferredTone}`)
      }
      if (goalProfile) {
        lines.push("", "Goal-specific profile (for this project):")
        lines.push(`- Experience level: ${goalProfile.experienceLevel}`)
        lines.push(`- Time per day: ${goalProfile.timePerDay}`)
        lines.push(`- Motivation: ${goalProfile.motivation}`)
        lines.push(`- Success definition: ${goalProfile.successDefinition}`)
        if (goalProfile.notes) lines.push(`- Notes: ${goalProfile.notes}`)
      }
      if (phaseTasks.length > 0) {
        lines.push("", "Phase tasks and completion state:")
        phaseTasks.forEach((t, idx) => {
          const status = t.completed ? "[x]" : "[ ]"
          const marker = idx === taskIndex ? " (CURRENT)" : ""
          lines.push(`${status} ${idx + 1}. ${t.title}${marker}`)
        })
        lines.push(
          "",
          "Use this to avoid re-teaching earlier tasks; you can reference what was already done when helpful.",
          "When the user seems to have achieved the outcome of this CURRENT task, explicitly tell them they can mark it complete and (optionally) move on to the next task.",
        )
      }
      if (lines.length > 0) {
        systemPrompt = `${systemPrompt}\n\nADDITIONAL CONTEXT:\n${lines.join("\n")}`
      }
      const history = updated
        .map((m) => `${m.role === "user" ? "User" : "Guide"}: ${m.content}`)
        .join("\n\n")
      const response = await callAI({
        prompt: history,
        systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 800,
        modelName: selectedModel,
      })
      const parsed = parseDuwitPayload(response)
      const assistantIndex = updated.length
      if (parsed.meta) {
        setYoutubeMeta((prev) => ({ ...prev, [assistantIndex]: parsed.meta! }))
      }
      const final: ChatMessage[] = [...updated, { role: "assistant", content: parsed.clean }]
      setMessages(final)
      if (uid) saveTaskChat(uid, goalId, phaseIndex, taskIndex, final).catch(console.error)
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, couldn't get a response. Please try again." },
      ])
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200">
      {/* Header */}
      <div className="shrink-0 border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 -ml-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground leading-none mb-0.5">AI Guide</p>
            <h2 className="font-bold text-sm leading-snug truncate">{task.title}</h2>
          </div>

          <div className="shrink-0 flex items-center gap-1.5 bg-brand/10 text-brand px-2.5 py-1 rounded-full">
            <Sparkles className="h-3 w-3" />
            <span className="text-xs font-semibold">AI</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {loadingHistory ? (
            <div className="flex justify-center py-12">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-6">
              {/* Task context card */}
              <div className="rounded-2xl bg-muted/40 border p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Your task
                </p>
                <p className="text-sm font-semibold">{task.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{task.description}</p>
              </div>

              {/* Suggested prompt */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 px-1">Try asking:</p>
                <button
                  onClick={() => sendMessage(suggestedPrompt)}
                  disabled={sending}
                  className="w-full text-left rounded-2xl border-2 border-dashed border-border/70 bg-card px-4 py-3.5 text-sm hover:border-brand/40 hover:bg-brand/5 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {suggestedPrompt}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  {(() => {
                    const isRtl = /[\u0600-\u06FF]/.test(msg.content)
                    return (
                  <div className="max-w-[85%]">
                    <div
                      dir={isRtl ? "rtl" : "ltr"}
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      } ${isRtl ? "text-right" : ""}`}
                    >
                      {msg.role === "assistant" ? (
                        <Markdown content={msg.content} className={isRtl ? "text-right" : undefined} />
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )}
                    </div>

                    {/* YouTube search chips (assistant only) */}
                    {msg.role === "assistant" && youtubeMeta[i] ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {youtubeMeta[i].youtubeSearches.map((q, qi) => (
                          <a
                            key={`y-${qi}`}
                            href={youtubeSearchUrl(q)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-brand/40 hover:bg-brand/5 transition-colors"
                          >
                            Search YouTube: {q}
                          </a>
                        ))}
                        {youtubeMeta[i].channels.map((c, ci) => (
                          <a
                            key={`c-${ci}`}
                            href={youtubeSearchUrl(c)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-brand/40 hover:bg-brand/5 transition-colors"
                          >
                            Channel: {c}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                    )
                  })()}
                </div>
              ))}

              {sending && (
                <div className="flex justify-start animate-in fade-in duration-150">
                  <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                // Auto-resize
                e.target.style.height = "auto"
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this task…"
              disabled={sending || loadingHistory}
              className="flex-1 resize-none rounded-2xl border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all placeholder:text-muted-foreground/60 disabled:opacity-50 leading-relaxed"
              style={{ minHeight: "42px", maxHeight: "120px", overflowY: "auto" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || sending || loadingHistory}
              className="h-[42px] w-[42px] shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-30 disabled:pointer-events-none"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
