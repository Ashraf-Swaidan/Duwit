import { useState, useRef, useEffect, useCallback } from "react"
import {
  ArrowLeft,
  PanelLeft,
  PanelLeftClose,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  BookOpen,
  ChevronRight as ArrowRight,
  Trash2,
  Copy,
  Check,
  ListChecks,
  Volume2,
  Phone,
  Loader2,
  Pause,
  Play,
  Square,
  Globe,
} from "lucide-react"
import type { Task, ChatMessage, GoalProfile, GoalState } from "@/services/goals"
import { saveTaskChat, loadTaskChatDocument } from "@/services/goals"
import type { TaskTeachingPersistV1 } from "@/services/taskTeaching"
import { TASK_COMPLETE_SUGGEST_MARKER } from "@/services/taskTeaching"
import {
  touchGoalActivity,
  recordQuizInGoalState,
  maybeCompressTaskChatIntoGoalState,
} from "@/services/goalState"
import { auth } from "@/lib/firebase"
import { callAIStream, type WebGroundingInfo } from "@/services/ai"
import { generateTaskGuideSystemPrompt, generateTaskSuggestedPrompt } from "@/services/prompts"
import { useModel } from "@/contexts/ModelContext"
import { Markdown } from "@/components/Markdown"
import { formatUserProfileForPrompt } from "@/services/user"
import { useProfileDialog } from "@/contexts/ProfileDialogContext"
import { useTaskTeaching } from "@/hooks/useTaskTeaching"
import { parseWidgets } from "@/lib/parseWidgets"
import { paragraphsForSpeech } from "@/lib/plainTextForSpeech"
import { speakWithBrowserTts, startGeminiTtsPlayback, type GeminiTtsHandle } from "@/services/geminiTts"
import { TaskVoiceCallPanel } from "@/components/TaskVoiceCallPanel"

interface TaskChatProps {
  task: Task
  goalId: string
  goalTitle: string
  phaseTitle: string
  phaseIndex: number
  taskIndex: number
  onClose: () => void
  goalProfile?: GoalProfile
  /** Unified coach memory across tasks */
  goalState?: GoalState | null
  /** After goalState updates in Firestore, refresh parent goal query */
  onGoalStateUpdated?: () => void
  phaseTasks: Task[]
  isDesktopSideView?: boolean
  onNavigateTask?: (direction: number) => void
  hasPrevTask?: boolean
  hasNextTask?: boolean
  onMarkComplete?: () => void
  /** Desktop split view: hide plan panel for a wider, centered reading column */
  readingFocusMode?: boolean
  onToggleReadingFocus?: () => void
}

function scrollToBottom(el: HTMLDivElement | null, smooth = true) {
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" })
}

function WebGroundingBlock({ info }: { info: WebGroundingInfo }) {
  const hasQ = info.webSearchQueries.length > 0
  const hasS = info.sources.length > 0
  if (!hasQ && !hasS) return null
  return (
    <div className="mt-2 rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5 space-y-2">
      {hasQ && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Web search
          </p>
          <div className="flex flex-wrap gap-1.5">
            {info.webSearchQueries.map((q, qi) => (
              <span
                key={qi}
                className="rounded-full bg-background/80 border border-border/60 px-2.5 py-0.5 text-[11px] text-foreground/90"
              >
                {q}
              </span>
            ))}
          </div>
        </div>
      )}
      {hasS && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Sources
          </p>
          <ul className="space-y-1">
            {info.sources.map((s, si) => (
              <li key={`${s.uri}-${si}`}>
                <a
                  href={s.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand hover:underline wrap-break-word"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
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
  onMarkComplete,
  readingFocusMode,
  onToggleReadingFocus,
  goalState,
  onGoalStateUpdated,
}: TaskChatProps) {
  const { selectedModel, selectedSearchModel } = useModel()
  const [focusMode, setFocusMode] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [youtubeMeta, setYoutubeMeta] = useState<Record<number, { youtubeSearches: string[]; channels: string[] }>>({})
  /** Per assistant message: web search queries + sources (session only; not persisted). */
  const [messageGrounding, setMessageGrounding] = useState<Record<number, WebGroundingInfo>>({})
  /** While streaming a reply with web search enabled. */
  const [webSearchStreamPhase, setWebSearchStreamPhase] = useState<"idle" | "searching" | "writing">("idle")
  const [streamingGrounding, setStreamingGrounding] = useState<WebGroundingInfo | null>(null)
  const [input, setInput] = useState("")
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [chatHydrationReady, setChatHydrationReady] = useState(false)
  const [loadedPersist, setLoadedPersist] = useState<TaskTeachingPersistV1 | null>(null)
  const [sessionKey, setSessionKey] = useState(0)
  const [checklistSelections, setChecklistSelections] = useState<Record<string, number[]>>({})
  const [sending, setSending] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [copied, setCopied] = useState(false)
  const [suggestedPrompt, setSuggestedPrompt] = useState(() => generateTaskSuggestedPrompt(task))
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const prevLengthRef = useRef(0)
  const quizGoalStateRecordedRef = useRef<string | null>(null)
  const { profile: userProfile } = useProfileDialog()
  const [autoReadAloud, setAutoReadAloud] = useState(false)
  const [voicePanelOpen, setVoicePanelOpen] = useState(false)
  const [voiceInstruction, setVoiceInstruction] = useState("")
  /** One TTS session at a time: loading until first audio, then playing/paused until done or cancel. */
  const [ttsSession, setTtsSession] = useState<
    null | { index: number; phase: "loading" | "playing" | "paused" }
  >(null)
  const ttsHandleRef = useRef<GeminiTtsHandle | null>(null)
  const ttsUserCancelledRef = useRef(false)

  const taskScopeKey = `${goalId}-${phaseIndex}-${taskIndex}`
  const siblingRoadmapTitles = phaseTasks
    .filter((_, idx) => idx !== taskIndex)
    .map((t) => t.title)

  const teaching = useTaskTeaching({
    task,
    goalTitle,
    phaseTitle,
    messages,
    selectedModel,
    historyReady: chatHydrationReady && !loadingHistory,
    persistedTeaching: loadedPersist,
    messagesLength: messages.length,
    sessionKey,
    taskScopeKey,
    siblingTaskTitles: siblingRoadmapTitles,
  })

  const handleChecklistChange = useCallback(
    (messageIndex: number, slot: number, indices: number[]) => {
      const key = `${messageIndex}-${slot}`
      setChecklistSelections((prev) => ({ ...prev, [key]: indices }))
    },
    [],
  )

  const handleVoiceTranscriptDelta = useCallback(
    (evt: { role: "user" | "assistant"; text: string }) => {
      const { role, text } = evt
      if (!text) return
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === role) {
          return [...prev.slice(0, -1), { role, content: last.content + text }]
        }
        return [...prev, { role, content: text }]
      })
    },
    [],
  )

  useEffect(() => {
    setSuggestedPrompt(generateTaskSuggestedPrompt(task))
  }, [task])

  function parseDuwitPayload(text: string): {
    clean: string
    meta?: { youtubeSearches: string[]; channels: string[] }
  } {
    const { segments } = parseWidgets(text)
    const widgets = segments.filter(
      (seg): seg is Extract<(typeof segments)[number], { kind: "widget" }> =>
        seg.kind === "widget",
    )

    // Preserve any non-YouTube widgets in the final message content.
    // The legacy clean/meta behavior should only run for old YouTube-only payloads.
    if (widgets.some((seg) => seg.widget.type !== "youtube")) {
      return { clean: text }
    }

    const textParts = segments
      .filter((seg) => seg.kind === "text")
      .map((seg) => seg.content)

    const clean = textParts.join("\n").trim()

    const youtubeWidget = segments.find(
      (seg) => seg.kind === "widget" && seg.widget.type === "youtube"
    )

    if (!youtubeWidget || youtubeWidget.kind !== "widget") {
      return { clean: clean || text }
    }

    const data = youtubeWidget.widget.data
    const youtubeSearches = Array.isArray(data.youtubeSearches)
      ? (data.youtubeSearches as string[]).slice(0, 8)
      : []
    const channels = Array.isArray(data.channels)
      ? (data.channels as string[]).slice(0, 8)
      : []

    if (youtubeSearches.length === 0 && channels.length === 0) {
      return { clean: clean || text }
    }

    return { clean: clean || text, meta: { youtubeSearches, channels } }
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
    void touchGoalActivity(uid, goalId, phaseIndex, taskIndex)
  }, [goalId, phaseIndex, taskIndex])

  useEffect(() => {
    quizGoalStateRecordedRef.current = null
  }, [goalId, phaseIndex, taskIndex])

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid || !teaching.quizResult) return
    const r = teaching.quizResult
    const sig = `${phaseIndex}_${taskIndex}_${r.score}_${r.total}_${r.passed}`
    if (quizGoalStateRecordedRef.current === sig) return
    quizGoalStateRecordedRef.current = sig
    void recordQuizInGoalState(
      uid,
      goalId,
      goalTitle,
      goalProfile,
      phaseIndex,
      taskIndex,
      task.title,
      r,
      selectedModel,
    )
      .then(() => onGoalStateUpdated?.())
      .catch(() => {})
  }, [
    teaching.quizResult,
    goalId,
    goalTitle,
    goalProfile,
    phaseIndex,
    taskIndex,
    task.title,
    selectedModel,
    onGoalStateUpdated,
  ])

  useEffect(() => {
    const uid = auth.currentUser?.uid
    let cancelled = false
    setChatHydrationReady(false)
    setLoadedPersist(null)
    if (!uid) {
      setLoadingHistory(false)
      setChatHydrationReady(true)
      return
    }
    setLoadingHistory(true)
    loadTaskChatDocument(uid, goalId, phaseIndex, taskIndex)
      .then(({ messages: saved, teachingPersist }) => {
        if (cancelled) return
        const nextMeta: Record<number, { youtubeSearches: string[]; channels: string[] }> = {}
        const cleaned = saved.map((m, idx) => {
          if (m.role !== "assistant") return m
          const parsed = parseDuwitPayload(m.content)
          if (parsed.meta) nextMeta[idx] = parsed.meta
          return { ...m, content: parsed.clean }
        })
        setYoutubeMeta(nextMeta)
        setMessages(cleaned)
        setLoadedPersist(teachingPersist)
        setChecklistSelections(teachingPersist?.checklistSelections ?? {})
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return
        setLoadingHistory(false)
        setChatHydrationReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [goalId, phaseIndex, taskIndex])

  // Persist messages + teaching snapshot. Never skip messages while plan is generating:
  // during "loading", omit teachingPersist (undefined) so merge keeps the existing snapshot.
  useEffect(() => {
    if (!chatHydrationReady || loadingHistory) return
    const uid = auth.currentUser?.uid
    if (!uid) return
    const persist =
      teaching.teachingState === "loading"
        ? undefined
        : teaching.getTeachingPersist(checklistSelections)
    void saveTaskChat(uid, goalId, phaseIndex, taskIndex, messages, persist).catch(console.error)
  }, [
    chatHydrationReady,
    loadingHistory,
    goalId,
    phaseIndex,
    taskIndex,
    messages,
    checklistSelections,
    teaching.teachingState,
    teaching.currentPhaseIndex,
    teaching.showAdvanceCard,
    teaching.offerTaskCompleteSuggest,
    teaching.quizQuestions,
    teaching.currentQuizIndex,
    teaching.quizAnswers,
    teaching.quizResult,
    teaching.phases,
    teaching.totalPhases,
    teaching.generatingQuiz,
  ])

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

  useEffect(() => {
    if (!voicePanelOpen) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [voicePanelOpen])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    return () => {
      ttsHandleRef.current?.cancel()
      ttsHandleRef.current = null
    }
  }, [])

  function buildCoachSystemPrompt(): string {
    const storedLessonObjectives =
      task.lessonSteps?.length &&
      teaching.teachingState === "teaching" &&
      task.lessonSteps[teaching.currentPhaseIndex]
        ? task.lessonSteps[teaching.currentPhaseIndex].objectives
        : undefined

    let systemPrompt = generateTaskGuideSystemPrompt(
      goalTitle,
      phaseTitle,
      task,
      teaching.teachingContext,
      {
        goalState: goalState ?? undefined,
        goalProfile: goalProfile ?? undefined,
        focusMode,
        planPhaseIndex: phaseIndex,
        planTaskIndex: taskIndex,
        siblingRoadmapTaskTitles: siblingRoadmapTitles,
        inChatPhaseTitles:
          teaching.phases.length > 0
            ? teaching.phases.map((p) => p.title)
            : undefined,
        storedLessonObjectives,
      },
    )

    const lines: string[] = []
    const profileBlock = formatUserProfileForPrompt(userProfile)
    if (profileBlock) lines.push(profileBlock)
    if (goalProfile) {
      lines.push("", "Goal-specific profile (detail):")
      lines.push(`- Experience level: ${goalProfile.experienceLevel}`)
      lines.push(`- Time per day: ${goalProfile.timePerDay}`)
      if (goalProfile.notes) lines.push(`- Notes: ${goalProfile.notes}`)
    }
    if (phaseTasks.length > 0) {
      lines.push("", "Checklist tasks in this roadmap section (each row = separate chat):")
      phaseTasks.forEach((t, idx) => {
        const status = t.completed ? "[x]" : "[ ]"
        const marker = idx === taskIndex ? " (THIS CHAT)" : ""
        lines.push(`${status} ${idx + 1}. ${t.title}${marker}`)
      })
      lines.push(
        "",
        "Sibling rows are not part of this chat's lesson steps. The 3 lesson steps (UI may say Phase 1–3) are micro-beats inside the CURRENT row only — lesson step 2 is never 'the next checkbox task'.",
      )
    }
    if (lines.length > 0) {
      systemPrompt = `${systemPrompt}\n\nADDITIONAL CONTEXT:\n${lines.join("\n")}`
    }
    return systemPrompt
  }

  function ttsCancel() {
    ttsUserCancelledRef.current = true
    ttsHandleRef.current?.cancel()
    ttsHandleRef.current = null
    setTtsSession(null)
  }

  /** Stop any in-flight playback without flagging as a user cancel (e.g. starting another message). */
  function stopTtsForNewSession() {
    ttsHandleRef.current?.cancel()
    ttsHandleRef.current = null
    setTtsSession(null)
  }

  function ttsPause() {
    ttsHandleRef.current?.pause()
    setTtsSession((s) => (s ? { ...s, phase: "paused" } : null))
  }

  function ttsResume() {
    ttsHandleRef.current?.resume()
    setTtsSession((s) => (s ? { ...s, phase: "playing" } : null))
  }

  async function playAssistantTts(messageIndex: number, rawContent: string) {
    const paras = paragraphsForSpeech(rawContent)
    if (!paras.length) return
    stopTtsForNewSession()
    ttsUserCancelledRef.current = false
    const handle = startGeminiTtsPlayback(paras, {
      onFirstAudioScheduled: () => {
        setTtsSession({ index: messageIndex, phase: "playing" })
      },
    })
    ttsHandleRef.current = handle
    setTtsSession({ index: messageIndex, phase: "loading" })
    try {
      await handle.done
    } catch {
      if (ttsUserCancelledRef.current) return
      if (ttsHandleRef.current !== handle) return
      speakWithBrowserTts(paras.join(" "), userProfile?.preferredLanguage ?? undefined)
    } finally {
      ttsUserCancelledRef.current = false
      if (ttsHandleRef.current === handle) {
        ttsHandleRef.current = null
        setTtsSession(null)
      }
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const uid = auth.currentUser?.uid
    const userMsg: ChatMessage = { role: "user", content: trimmed }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput("")
    if (inputRef.current) inputRef.current.style.height = "auto"
    setSending(true)
    setWebSearchStreamPhase("idle")
    setStreamingGrounding(null)

    try {
      const systemPrompt = buildCoachSystemPrompt()

      // XML-style tags make it harder for the model to pattern-match and
      // continue both sides of the conversation.
      const history = updated
        .map((m) =>
          m.role === "user"
            ? `<student>${m.content}</student>`
            : `<teacher>${m.content}</teacher>`,
        )
        .join("\n")
        // Ask the model to produce only the next teacher turn
        + "\n<teacher>"

      // Truncate any hallucinated student continuation from the raw stream
      function truncateAtStudentTurn(text: string): string {
        // Strip the closing </teacher> tag if the model added it
        let clean = text.replace(/<\/teacher>[\s\S]*$/, "").trim()
        // Also cut off if model writes a <student> tag or common prefixes
        const cutPatterns = [/<student>/i, /\nStudent:/i, /\nUser:/i, /\nMe:/i]
        for (const pat of cutPatterns) {
          const idx = clean.search(pat)
          if (idx !== -1) clean = clean.slice(0, idx).trim()
        }
        return clean
      }

      // Add a placeholder assistant message that streams in
      const assistantIndex = updated.length
      setMessages([...updated, { role: "assistant", content: "" }])

      let accumulated = ""
      setWebSearchStreamPhase("searching")
      const { text: response, grounding: responseGrounding } = await callAIStream({
        prompt: history,
        systemPrompt,
        temperature: focusMode ? 0.42 : 0.55,
        maxOutputTokens: focusMode ? 650 : 900,
        modelName: selectedSearchModel ?? selectedModel,
        enableWebSearch: true,
        onStreamProgress: (evt) => {
          if (evt.type === "phase") {
            setWebSearchStreamPhase(evt.phase)
            return
          }
          if (evt.type === "grounding") {
            setStreamingGrounding(evt.data)
          }
        },
        onChunk: (piece) => {
          accumulated += piece
          const displayText = truncateAtStudentTurn(
            accumulated
              .replaceAll("[PHASE_COMPLETE]", "")
              .replaceAll("[QUIZ_READY]", "")
              .replaceAll(TASK_COMPLETE_SUGGEST_MARKER, ""),
          )
          setMessages([...updated, { role: "assistant", content: displayText }])
        },
      })

      // Final: truncate hallucinated student turns, strip markers, parse duwit payload
      const cleanedResponse = truncateAtStudentTurn(response)
      const markerStripped = teaching.handleAIMarkers(cleanedResponse)
      const parsed = parseDuwitPayload(markerStripped)
      if (parsed.meta) {
        setYoutubeMeta((prev) => ({ ...prev, [assistantIndex]: parsed.meta! }))
      }
      const final: ChatMessage[] = [...updated, { role: "assistant", content: parsed.clean }]
      setMessages(final)
      if (responseGrounding && (responseGrounding.webSearchQueries.length > 0 || responseGrounding.sources.length > 0)) {
        setMessageGrounding((prev) => ({ ...prev, [assistantIndex]: responseGrounding }))
      }
      setWebSearchStreamPhase("idle")
      setStreamingGrounding(null)
      if (autoReadAloud) {
        const last = final[final.length - 1]
        if (last?.role === "assistant" && last.content.trim()) {
          void playAssistantTts(final.length - 1, last.content)
        }
      }
      if (uid && chatHydrationReady) {
        void saveTaskChat(uid, goalId, phaseIndex, taskIndex, final, undefined).catch(console.error)
      }
      if (uid) {
        void touchGoalActivity(uid, goalId, phaseIndex, taskIndex)
        void maybeCompressTaskChatIntoGoalState(
          uid,
          goalId,
          goalTitle,
          goalProfile,
          phaseIndex,
          taskIndex,
          task.title,
          final,
          selectedModel,
        )
          .then((did) => {
            if (did) onGoalStateUpdated?.()
          })
          .catch(() => {})
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, couldn't get a response. Please try again." },
      ])
      setWebSearchStreamPhase("idle")
      setStreamingGrounding(null)
    } finally {
      setSending(false)
    }
  }

  function copyChat() {
    if (!messages.length) return
    const text = messages
      .map((m) => `[${m.role === "user" ? "Me" : "AI"}]\n${m.content}`)
      .join("\n\n---\n\n")
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function resetChat() {
    const uid = auth.currentUser?.uid
    setMessages([])
    setYoutubeMeta({})
    setChecklistSelections({})
    setLoadedPersist(null)
    setSessionKey((k) => k + 1)
    setInput("")
    setConfirmReset(false)
    setMessageGrounding({})
    setWebSearchStreamPhase("idle")
    setStreamingGrounding(null)
    if (uid) await saveTaskChat(uid, goalId, phaseIndex, taskIndex, [], null).catch(console.error)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const maxWidth =
    isDesktopSideView && readingFocusMode
      ? "max-w-4xl"
      : isDesktopSideView
        ? "max-w-3xl"
        : "max-w-lg"
  const isQuizMode = teaching.teachingState === "quiz_active"
  const isQuizResultMode =
    teaching.teachingState === "quiz_result_pass" ||
    teaching.teachingState === "quiz_result_fail"
  const chatInputDisabled = sending || loadingHistory || teaching.teachingState === "loading"

  const structuredTeachingChrome =
    teaching.teachingState !== null &&
    teaching.teachingState !== "loading" &&
    teaching.totalPhases > 0

  const headerTeachingLabel = (() => {
    if (!structuredTeachingChrome) return null
    const n = teaching.totalPhases
    if (
      teaching.teachingState === "quiz_active" ||
      teaching.teachingState === "quiz_result_pass" ||
      teaching.teachingState === "quiz_result_fail"
    ) {
      return "Quiz · scored MCQ"
    }
    if (teaching.teachingState === "quiz_prompt") {
      return `Phases done · ${n}/${n} → quiz`
    }
    if (teaching.teachingState === "recap") {
      return "Quiz review"
    }
    return `Phase ${teaching.currentPhaseIndex + 1}/${n}`
  })()

  return (
    <div className={`${isDesktopSideView ? "h-full" : "fixed inset-0 z-50"} flex flex-col bg-background animate-in fade-in duration-200`}>

      {/* ── Context bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="px-3 h-11 flex items-center gap-2">
          <button
            onClick={onClose}
            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Back to plan"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {isDesktopSideView && onToggleReadingFocus && (
            <button
              type="button"
              onClick={onToggleReadingFocus}
              className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={readingFocusMode ? "Show plan sidebar" : "Focus on chat (hide plan)"}
            >
              {readingFocusMode ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}

          <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
            <span className="text-[11px] text-muted-foreground truncate shrink-0 max-w-[100px] sm:max-w-[160px]">
              {phaseTitle}
            </span>
            <span className="text-muted-foreground/40 shrink-0 text-[11px]">›</span>
            <span className="text-[11px] font-semibold text-foreground truncate">{task.title}</span>
          </div>

          {headerTeachingLabel && (
            <div className="shrink-0 flex items-center gap-1.5 bg-brand/10 text-brand px-2.5 py-0.5 rounded-full border border-brand/20 max-w-[140px] sm:max-w-none">
              <BookOpen className="h-3 w-3 shrink-0" />
              <span className="text-[10px] font-bold truncate">{headerTeachingLabel}</span>
            </div>
          )}

          {!headerTeachingLabel && (
            <div className="shrink-0 flex items-center gap-1 bg-brand/10 text-brand px-2 py-0.5 rounded-full border border-brand/20">
              <Sparkles className="h-3 w-3" />
              <span className="text-[9px] font-black uppercase tracking-tight">AI</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setFocusMode((v) => !v)}
            className={`shrink-0 h-7 w-7 flex items-center justify-center rounded-full transition-colors ${
              focusMode
                ? "bg-brand/15 text-brand border border-brand/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title={focusMode ? "Focus mode on — shorter, execution-style replies" : "Focus mode — shorter replies"}
          >
            <ListChecks className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setAutoReadAloud((v) => !v)}
            className={`shrink-0 h-7 w-7 flex items-center justify-center rounded-full transition-colors ${
              autoReadAloud
                ? "bg-brand/15 text-brand border border-brand/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title={autoReadAloud ? "Auto-read: on — new AI replies are spoken" : "Auto-read: off — tap Listen on a message to hear it"}
          >
            <Volume2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setVoiceInstruction(buildCoachSystemPrompt())
              setVoicePanelOpen(true)
            }}
            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Voice call with AI coach (microphone)"
          >
            <Phone className="h-3.5 w-3.5" />
          </button>

          {/* Copy chat button */}
          {messages.length > 0 && (
            <button
              onClick={copyChat}
              className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Copy chat"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-brand" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {/* Reset button — only when there are messages */}
          {messages.length > 0 && !sending && (
            confirmReset ? (
              <div className="shrink-0 flex items-center gap-1 animate-in fade-in duration-150">
                <button
                  onClick={resetChat}
                  className="h-6 px-2 rounded-full bg-destructive/90 text-white text-[10px] font-bold hover:bg-destructive transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="h-6 px-2 rounded-full border border-border/80 text-[10px] font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Clear chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )
          )}

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

        {/* Phase progress bar */}
        {structuredTeachingChrome && teaching.teachingState === "teaching" && (
          <div className="h-0.5 bg-muted/60 mx-3 mb-0.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand/60 rounded-full transition-all duration-500"
              style={{
                width: `${((teaching.currentPhaseIndex + 1) / teaching.totalPhases) * 100}%`,
              }}
            />
          </div>
        )}
        {structuredTeachingChrome &&
          (teaching.teachingState === "quiz_active" ||
            teaching.teachingState === "quiz_result_pass" ||
            teaching.teachingState === "quiz_result_fail") && (
            <div className="h-0.5 bg-muted/60 mx-3 mb-0.5 rounded-full overflow-hidden">
              <div className="h-full w-full bg-brand/50 rounded-full" />
            </div>
          )}
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className={`mx-auto px-4 pt-5 pb-4 space-y-4 ${maxWidth}`}>

          {/* Loading plan spinner */}
          {teaching.teachingState === "loading" && (
            <div className="flex flex-col items-center gap-3 py-10 animate-in fade-in duration-300">
              <div className="relative">
                <div className="h-12 w-12 rounded-full bg-brand/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-brand" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-brand/20 animate-ping" />
              </div>
              <p className="text-sm font-semibold">Building your teaching plan…</p>
              <p className="text-xs text-muted-foreground">Personalising for this task</p>
            </div>
          )}

          {/* History loading */}
          {loadingHistory && teaching.teachingState !== "loading" && (
            <div className="flex justify-center py-12">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loadingHistory && messages.length === 0 && teaching.teachingState !== "loading" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="rounded-2xl bg-muted/40 border p-4 space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Your task</p>
                <p className="text-sm font-semibold">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{task.description}</p>
                )}
              </div>
              {!teaching.teachingState && (
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
              )}
            </div>
          )}

          {/* Messages */}
          {!loadingHistory && messages.length > 0 && (
            <div className="space-y-4">
              {messages.map((msg, i) => {
                const isRtl = /[\u0600-\u06FF]/.test(msg.content)
                return (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div className={msg.role === "user" ? "max-w-[min(82%,28rem)]" : "w-full"}>
                      {msg.role === "assistant" ? (
                        /* AI: no bubble — full-width, comfortable reading */
                        <div
                          dir={isRtl ? "rtl" : "ltr"}
                          className={`text-sm leading-7 text-foreground py-1 ${isRtl ? "text-right" : ""}`}
                        >
                          <Markdown
                            content={msg.content}
                            className={isRtl ? "text-right" : undefined}
                            getChecklistInitial={(slot) => checklistSelections[`${i}-${slot}`]}
                            onChecklistChange={(slot, indices) =>
                              handleChecklistChange(i, slot, indices)
                            }
                          />
                          {msg.content.trim() !== "" && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {ttsSession?.index === i && ttsSession.phase === "loading" ? (
                                <>
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Preparing voice…
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => ttsCancel()}
                                    className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted"
                                    title="Stop"
                                  >
                                    <Square className="h-3 w-3" />
                                    Stop
                                  </button>
                                </>
                              ) : ttsSession?.index === i && ttsSession.phase === "playing" ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => ttsPause()}
                                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted"
                                    title="Pause"
                                  >
                                    <Pause className="h-3 w-3" />
                                    Pause
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => ttsCancel()}
                                    className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted"
                                    title="Stop"
                                  >
                                    <Square className="h-3 w-3" />
                                    Stop
                                  </button>
                                </>
                              ) : ttsSession?.index === i && ttsSession.phase === "paused" ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => ttsResume()}
                                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted"
                                    title="Resume"
                                  >
                                    <Play className="h-3 w-3" />
                                    Resume
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => ttsCancel()}
                                    className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted"
                                    title="Stop"
                                  >
                                    <Square className="h-3 w-3" />
                                    Stop
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void playAssistantTts(i, msg.content)}
                                  disabled={ttsSession !== null && ttsSession.index !== i}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-brand/40 hover:bg-brand/5 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                  title="Read this reply aloud (Gemini TTS)"
                                >
                                  <Volume2 className="h-3 w-3" />
                                  Listen
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* User: fixed corner radius avoids collapsing to a circle on narrow widths */
                        <div
                          dir={isRtl ? "rtl" : "ltr"}
                          className={`rounded-[1.25rem] px-4 py-2.5 text-sm leading-relaxed bg-primary text-primary-foreground ${isRtl ? "text-right" : "text-left"}`}
                        >
                          <span className="whitespace-pre-wrap block">{msg.content}</span>
                        </div>
                      )}

                      {msg.role === "assistant" && messageGrounding[i] ? (
                        <WebGroundingBlock info={messageGrounding[i]} />
                      ) : null}

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
                  </div>
                )
              })}

              {/* Web search status + typing dots before first visible text */}
              {sending && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content === "" && (
                <div className="flex flex-col justify-start gap-2 animate-in fade-in duration-150 py-1">
                  <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-[11px] max-w-[min(100%,28rem)] space-y-1.5">
                    <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                      <Globe className="h-3.5 w-3.5 shrink-0 text-brand/80" />
                      {webSearchStreamPhase === "searching" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                          <span>Searching the web…</span>
                        </>
                      ) : (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 opacity-70" aria-hidden />
                          <span>Composing answer…</span>
                        </>
                      )}
                    </div>
                    {streamingGrounding && streamingGrounding.webSearchQueries.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {streamingGrounding.webSearchQueries.map((q, qi) => (
                          <span
                            key={qi}
                            className="rounded-full bg-background/90 border border-border/50 px-2 py-0.5 text-[10px] leading-tight text-foreground/90"
                          >
                            {q}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 items-center h-6">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Suggested: mark task complete (model emitted [TASK_COMPLETE_SUGGEST]) ── */}
          {teaching.offerTaskCompleteSuggest &&
            !isQuizMode &&
            !isQuizResultMode &&
            teaching.teachingState !== "quiz_prompt" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-2xl border border-green-500/25 bg-green-500/5 p-4 space-y-3">
                <p className="text-sm font-semibold">Ready to finish this task?</p>
                <p className="text-xs text-muted-foreground">
                  Mark it complete on your plan when you&apos;re satisfied, or open the next task.
                </p>
                <div className="flex flex-wrap gap-2">
                  {onMarkComplete && (
                    <button
                      type="button"
                      onClick={() => {
                        teaching.dismissTaskCompleteSuggest()
                        onMarkComplete()
                        onClose()
                      }}
                      className="h-9 px-4 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand/90"
                    >
                      Mark complete
                    </button>
                  )}
                  {onNavigateTask && hasNextTask && (
                    <button
                      type="button"
                      onClick={() => {
                        teaching.dismissTaskCompleteSuggest()
                        onNavigateTask(1)
                      }}
                      className="h-9 px-4 rounded-xl border border-border/80 text-xs font-semibold hover:bg-muted"
                    >
                      Next task
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => teaching.dismissTaskCompleteSuggest()}
                    className="h-9 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Not yet
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Phase Advance Card ─────────────────────────────────────── */}
          {teaching.showAdvanceCard && teaching.currentPhase && !isQuizMode && !isQuizResultMode && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-brand/15 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      Phase {teaching.currentPhaseIndex + 1} complete — "{teaching.currentPhase.title}"
                    </p>
                    {teaching.currentPhaseIndex + 1 < teaching.totalPhases && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Next: Phase {teaching.currentPhaseIndex + 2} —{" "}
                        {teaching.phases[teaching.currentPhaseIndex + 1]?.title}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const line = teaching.advancePhaseAndGetContinuePrompt()
                      void sendMessage(line)
                    }}
                    className="flex-1 h-9 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    Next phase
                  </button>
                  <button
                    type="button"
                    onClick={teaching.stayInPhase}
                    className="h-9 px-4 rounded-xl border border-border/80 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Tell me more
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Quiz Prompt Card ───────────────────────────────────────── */}
          {teaching.teachingState === "quiz_prompt" && !isQuizMode && !isQuizResultMode && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Trophy className="h-3.5 w-3.5 text-brand" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Ready to test your knowledge?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Four multiple-choice questions (pick one correct answer each) — saved if you leave and come back.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={teaching.startQuiz}
                  disabled={teaching.generatingQuiz}
                  className="w-full h-9 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {teaching.generatingQuiz ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" />
                    </>
                  ) : "Start Quiz"}
                </button>
              </div>
            </div>
          )}

          {/* ── Quiz: Active ───────────────────────────────────────────── */}
          {isQuizMode && teaching.quizQuestions.length > 0 && (
            <div className="animate-in fade-in duration-300 space-y-4">
              {/* Question progress */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Question {teaching.currentQuizIndex + 1} of {teaching.quizQuestions.length}
                </p>
                <div className="flex gap-1">
                  {teaching.quizQuestions.map((_, qi) => (
                    <span
                      key={qi}
                      className={`h-1.5 w-5 rounded-full transition-colors ${
                        qi < teaching.currentQuizIndex
                          ? "bg-brand"
                          : qi === teaching.currentQuizIndex
                          ? "bg-brand/50"
                          : "bg-muted-foreground/20"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Question card */}
              {(() => {
                const q = teaching.quizQuestions[teaching.currentQuizIndex]
                if (!q) return null
                return (
                  <div className="rounded-2xl border bg-card p-4 space-y-4">
                    <p className="text-sm font-semibold leading-snug">{q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((option, oi) => (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => teaching.answerQuizQuestion(oi)}
                          className="w-full text-left rounded-xl border border-border/80 bg-background/60 px-4 py-3 text-sm hover:bg-brand/5 hover:border-brand/40 transition-all duration-150 active:scale-[0.98]"
                        >
                          <span className="font-bold text-brand mr-2">
                            {String.fromCharCode(65 + oi)}.
                          </span>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Quiz: Pass Result ──────────────────────────────────────── */}
          {teaching.teachingState === "quiz_result_pass" && teaching.quizResult && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
              <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-5 text-center space-y-3">
                <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <Trophy className="h-7 w-7 text-green-500" />
                </div>
                <div>
                  <p className="font-bold text-base">Well done!</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    You scored{" "}
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {teaching.quizResult.score}%
                    </span>{" "}
                    ({Math.round((teaching.quizResult.score / 100) * teaching.quizResult.total)}/
                    {teaching.quizResult.total} correct)
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  You've mastered this task. Mark it as complete to move forward.
                </p>
              </div>

              <div className="flex gap-2">
                {onMarkComplete && (
                  <button
                    type="button"
                    onClick={() => { onMarkComplete(); onClose() }}
                    className="flex-1 h-10 rounded-2xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Complete
                  </button>
                )}
                {onNavigateTask && hasNextTask && (
                  <button
                    type="button"
                    onClick={() => onNavigateTask(1)}
                    className="flex-1 h-10 rounded-2xl border border-border/80 text-sm font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-2"
                  >
                    Next Task
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Quiz: Fail Result ──────────────────────────────────────── */}
          {teaching.teachingState === "quiz_result_fail" && teaching.quizResult && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <XCircle className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Not quite yet</p>
                    <p className="text-xs text-muted-foreground">
                      {teaching.quizResult.score}% —{" "}
                      {Math.round((teaching.quizResult.score / 100) * teaching.quizResult.total)}/
                      {teaching.quizResult.total} correct. You need 70% to pass.
                    </p>
                  </div>
                </div>

                {teaching.quizResult.weakAreas.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Areas to revisit:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {teaching.quizResult.weakAreas.map((area, i) => (
                        <span
                          key={i}
                          className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20 font-medium"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    teaching.startRecap()
                    const areas = teaching.quizResult?.weakAreas.join(", ")
                    sendMessage(`I need help reviewing these areas: ${areas}. Can you re-teach them with different examples?`)
                  }}
                  className="flex-1 h-10 rounded-2xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors flex items-center justify-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Interactive Recap
                </button>
                <button
                  type="button"
                  onClick={teaching.retakeQuiz}
                  disabled={teaching.generatingQuiz}
                  className="h-10 px-4 rounded-2xl border border-border/80 text-sm font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retake
                </button>
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="h-24" />
        </div>
      </div>

      {/* ── Floating input (hidden during active quiz) ───────────────────── */}
      {!isQuizMode && !isQuizResultMode && (
        <div className={`shrink-0 px-4 pb-5 pt-2 ${maxWidth} mx-auto w-full`}>
          {voicePanelOpen ? (
            <TaskVoiceCallPanel
              open={voicePanelOpen}
              onClose={() => setVoicePanelOpen(false)}
              systemInstruction={voiceInstruction}
              onTranscriptDelta={handleVoiceTranscriptDelta}
            />
          ) : (
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
                placeholder={
                  teaching.teachingState === "recap"
                    ? "Continue the recap conversation…"
                    : "Ask about this task…"
                }
                disabled={chatInputDisabled}
                className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60 disabled:opacity-50 leading-relaxed py-1"
                style={{ minHeight: "24px", maxHeight: "120px", overflowY: "auto" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || chatInputDisabled}
                className="shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-30 disabled:pointer-events-none shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
