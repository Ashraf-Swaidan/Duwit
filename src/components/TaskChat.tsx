import { useState, useRef, useEffect } from "react"
import { ArrowLeft, ChevronLeft, ChevronRight, Send, Sparkles } from "lucide-react"
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
  isDesktopSideView?: boolean
  onNavigateTask?: (direction: number) => void
  hasPrevTask?: boolean
  hasNextTask?: boolean
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
  isDesktopSideView,
  onNavigateTask,
  hasPrevTask,
  hasNextTask,
}: TaskChatProps) {
  const { selectedModel } = useModel()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [youtubeMeta, setYoutubeMeta] = useState<Record<number, { youtubeSearches: string[]; channels: string[] }>>({})
  const [input, setInput] = useState("")
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [sending, setSending] = useState(false)
  const [suggestedPrompt, setSuggestedPrompt] = useState(() => generateTaskSuggestedPrompt(task))
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const prevLengthRef = useRef(0)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    setSuggestedPrompt(generateTaskSuggestedPrompt(task))
  }, [task])

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

  // Lock body scroll when open (only for mobile overlay)
  useEffect(() => {
    if (isDesktopSideView) return
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [isDesktopSideView])

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    getUserProfile(uid).then(setUserProfile).catch(() => setUserProfile(null))
  }, [])

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) { setLoadingHistory(false); return }
    setLoadingHistory(true)
    loadTaskChat(uid, goalId, phaseIndex, taskIndex)
      .then((saved) => {
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
    setInput(
      // reset auto-height
      ""
    )
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
    }
    setSending(true)

    try {
      let systemPrompt = generateTaskGuideSystemPrompt(goalTitle, phaseTitle, task)

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
        setYoutubeMeta((prev: Record<number, { youtubeSearches: string[]; channels: string[] }>) => ({ ...prev, [assistantIndex]: parsed.meta! }))
      }
      const final: ChatMessage[] = [...updated, { role: "assistant", content: parsed.clean }]
      setMessages(final)
      if (uid) saveTaskChat(uid, goalId, phaseIndex, taskIndex, final).catch(console.error)
    } catch {
      setMessages((prev: ChatMessage[]) => [
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
    <div className={`${isDesktopSideView ? 'h-full' : 'fixed inset-0 z-50'} flex flex-col bg-background animate-in fade-in duration-200`}>
      {/* ── Unified context bar ── */}
      <div className="shrink-0 border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="px-3 h-11 flex items-center gap-2">

          {/* Back / close button */}
          <button
            onClick={onClose}
            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Back to plan"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {/* Breadcrumb: phase › task */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
            <span className="text-[11px] text-muted-foreground truncate shrink-0 max-w-[100px] sm:max-w-[160px]">
              {phaseTitle}
            </span>
            <span className="text-muted-foreground/40 shrink-0 text-[11px]">›</span>
            <span className="text-[11px] font-semibold text-foreground truncate">
              {task.title}
            </span>
          </div>

          {/* AI badge */}
          <div className="shrink-0 flex items-center gap-1 bg-brand/10 text-brand px-2 py-0.5 rounded-full border border-brand/20">
            <Sparkles className="h-3 w-3" />
            <span className="text-[9px] font-black uppercase tracking-tight">AI</span>
          </div>

          {/* Prev / Next arrows */}
          {onNavigateTask && (
            <div className="shrink-0 flex items-center gap-0.5 border-l border-border/60 pl-2 ml-1">
              <button
                disabled={!hasPrevTask}
                onClick={() => onNavigateTask(-1)}
                className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
                title="Previous task"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                disabled={!hasNextTask}
                onClick={() => onNavigateTask(1)}
                className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
                title="Next task"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className={`mx-auto px-4 pt-5 pb-4 space-y-4 ${isDesktopSideView ? 'max-w-3xl' : 'max-w-lg'}`}>
          {loadingHistory ? (
            <div className="flex justify-center py-12">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-5">
              {/* Task context card */}
              <div className="rounded-2xl bg-muted/40 border p-4 space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Your task</p>
                <p className="text-sm font-semibold">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{task.description}</p>
                )}
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
              {messages.map((msg: ChatMessage, i: number) => {
                const isRtl = /[\u0600-\u06FF]/.test(msg.content)
                return (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div className="max-w-[85%]">
                      <div
                        dir={isRtl ? "rtl" : "ltr"}
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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

                      {/* YouTube search chips */}
                      {msg.role === "assistant" && youtubeMeta[i] ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {youtubeMeta[i].youtubeSearches.map((q: string, qi: number) => (
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
                          {youtubeMeta[i].channels.map((c: string, ci: number) => (
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
                  </div>
                )
              })}

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

          {/* Spacer so floating input doesn't overlap last message */}
          <div className="h-24" />
        </div>
      </div>

      {/* ── Floating input ── */}
      <div className={`shrink-0 px-4 pb-5 pt-2 ${isDesktopSideView ? 'max-w-3xl mx-auto w-full' : 'max-w-lg mx-auto w-full'}`}>
        <div className="flex gap-2 items-center bg-card border border-border/80 shadow-lg shadow-black/5 rounded-3xl px-4 py-2 focus-within:border-ring/40 focus-within:ring-2 focus-within:ring-ring/20 transition-all duration-200">
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
            placeholder="Ask about this task…"
            disabled={sending || loadingHistory}
            className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60 disabled:opacity-50 leading-relaxed py-1"
            style={{ minHeight: "24px", maxHeight: "120px", overflowY: "auto" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending || loadingHistory}
            className="shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-30 disabled:pointer-events-none shadow-sm"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
