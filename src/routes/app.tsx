import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { auth } from "@/lib/firebase"
import { getUserGoals } from "@/services/goals"
import { useQuery } from '@tanstack/react-query'
import {
  buildContextHash,
  buildInstantGreeting,
  buildGoalSuggestions,
  goalsToConciergeRows,
  loadCachedGreeting,
  saveCachedGreeting,
  type CachedGreeting,
} from "@/services/userContext"
import {
  callAI,
  callAIStream,
  generateImage,
  isVertexRateLimitError,
  VERTEX_RATE_LIMIT_USER_MESSAGE,
} from "@/services/ai"
import { HOME_CONCIERGE_SYSTEM_PROMPT, generateHomeConciergePrompt } from "@/services/prompts"
import { formatUserProfileForPrompt } from "@/services/user"
import { useProfileDialog } from "@/contexts/ProfileDialogContext"
import { Send, Sparkles } from 'lucide-react'
import { Markdown } from "@/components/Markdown"
import { loadHomeChat, saveHomeChat, clearHomeChat } from "@/services/homeChatStore"
import { useModel } from "@/contexts/ModelContext"
import { RequireAuth } from "@/components/RequireAuth"

export const Route = createFileRoute('/app')({
  component: AppRoute,
})

function AppRoute() {
  return (
    <RequireAuth>
      <HomePage />
    </RequireAuth>
  )
}

interface Message {
  role: 'assistant' | 'user'
  content: string
}

const NAVIGATE_REGEX = /\[NAVIGATE:([^\]]+)\]/
/** Sentinel from HOME_CONCIERGE_SYSTEM_PROMPT — opens /new-goal, not a Firestore id */
const NAVIGATE_NEW_GOAL = 'new-goal'

function HomePage() {
  const user = auth.currentUser
  const navigate = useNavigate()
  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there'
  const { selectedModel, selectedImageModel } = useModel()
  const { profile: userProfile } = useProfileDialog()

  const conciergeSystemPrompt = (() => {
    const block = formatUserProfileForPrompt(userProfile)
    return block ? `${HOME_CONCIERGE_SYSTEM_PROMPT}\n\n${block}` : HOME_CONCIERGE_SYSTEM_PROMPT
  })()

  const { data: goals = [], isPending: goalsLoading } = useQuery({
    queryKey: ['goals', user?.uid],
    queryFn: () => (user ? getUserGoals(user.uid) : Promise.resolve([])),
    enabled: !!user,
  })

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [greetingReady, setGreetingReady] = useState(false)
  const [pendingNavGoalId, setPendingNavGoalId] = useState<string | null>(null)
  const [isNavigatingGoal, setIsNavigatingGoal] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const goalsContextHashRef = useRef<string | null>(null)

  // ─── Boot: hydrate or show greeting on goals load ─────────────────────────
  useEffect(() => {
    if (greetingReady || goalsLoading) return

    // 0) Try to hydrate recent chat from in-memory store (soft session memory)
    const cached = loadHomeChat()
    const STALE_MS = 30 * 60 * 1000 // 30 minutes
    const isFresh = cached.lastUpdated && Date.now() - cached.lastUpdated < STALE_MS

    if (cached.messages.length > 0 && isFresh) {
      let pending = cached.pendingNavGoalId
      if (pending && pending !== NAVIGATE_NEW_GOAL && !goals.some((g) => g.id === pending)) {
        pending = null
      }
      const userSpoke = cached.messages.some((m) => m.role === "user")
      const pristineOpener =
        !userSpoke && cached.messages.length === 1 && cached.messages[0].role === "assistant"
      setMessages(
        pristineOpener
          ? [{ role: "assistant", content: buildInstantGreeting(firstName, goals) }]
          : cached.messages,
      )
      setPendingNavGoalId(pending)
      setGreetingReady(true)
      return
    } else if (cached.messages.length > 0 && !isFresh) {
      clearHomeChat()
    }

    if (goals.length === 0) {
      // For users with no goals, show a generic welcome immediately
      setMessages([{
        role: 'assistant',
        content: `Hey ${firstName}! 👋 I'm Duwit, your personal growth assistant.\n\nWhat's a goal you've been meaning to work on? I'll build you a personalised plan.`,
      }])
      setGreetingReady(true)
      return
    }

    if (goals.length > 0) {
      initGreeting()
    }
  }, [goals, goalsLoading, greetingReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // When goals change (e.g. deleted elsewhere), drop stale nav + refresh template opener if user hasn’t chatted yet
  useEffect(() => {
    if (goalsLoading || !greetingReady) return

    const hash = buildContextHash(goals)
    if (goalsContextHashRef.current === hash) return

    const hadPreviousSnapshot = goalsContextHashRef.current !== null
    goalsContextHashRef.current = hash

    setPendingNavGoalId((p) => {
      if (!p || p === NAVIGATE_NEW_GOAL) return p
      return goals.some((g) => g.id === p) ? p : null
    })

    if (!hadPreviousSnapshot) return

    setMessages((prev) => {
      const userSpoke = prev.some((m) => m.role === "user")
      if (userSpoke || prev.length !== 1 || prev[0].role !== "assistant") return prev
      return [{ role: "assistant", content: buildInstantGreeting(firstName, goals) }]
    })
  }, [goals, goalsLoading, greetingReady, firstName])

  async function initGreeting() {
    setGreetingReady(true)

    // 1. Show instant template greeting right away
    const instant = buildInstantGreeting(firstName, goals)
    setMessages([{ role: 'assistant', content: instant }])

    if (!user) return

    // 2. Check if cached AI greeting is still valid
    const hash = buildContextHash(goals)
    let cached: CachedGreeting | null = null
    try {
      cached = await loadCachedGreeting(user.uid)
    } catch (_) { /* network error, continue */ }

    if (cached && cached.contextHash === hash) {
      // Cache still valid and fresh – keep it for next session, but
      // do NOT mutate the already shown greeting in this view.
      const twelveHoursMs = 12 * 60 * 60 * 1000
      if (Date.now() - new Date(cached.generatedAt).getTime() < twelveHoursMs) {
        return
      }
    }

    // 3. Context changed — ask AI for a fresh greeting in the background
    try {
      const goalData = goalsToConciergeRows(goals)
      const greetingPrompt = generateHomeConciergePrompt(goalData, `The user just opened the app. Generate a warm, personalised greeting (2-3 sentences) that:\n- Acknowledges their most in-progress or recently active goal\n- Suggests they continue it or asks what they'd like to focus on today\n- Feels conversational, not scripted`)
      const aiGreeting = await callAI({
        prompt: greetingPrompt,
        systemPrompt: conciergeSystemPrompt,
        temperature: 0.55,
        maxOutputTokens: 150,
        modelName: selectedModel,
      })

      const cleanGreeting = aiGreeting.replace(NAVIGATE_REGEX, '').trim()

      // Save to cache
      const newCache: CachedGreeting = {
        message: cleanGreeting,
        generatedAt: new Date().toISOString(),
        contextHash: hash,
      }
      await saveCachedGreeting(user.uid, newCache).catch(() => {})
    } catch (_) {
      // AI call failed, template greeting is already shown — that's fine
    }
  }

  // ─── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  // ─── Keep in-memory store in sync ─────────────────────────────────────────
  useEffect(() => {
    // Don't overwrite any existing snapshot with an empty one
    if (messages.length === 0 && !pendingNavGoalId) return
    saveHomeChat(messages, pendingNavGoalId)
  }, [messages, pendingNavGoalId])

  // ─── Send a message ───────────────────────────────────────────────────────
  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isThinking) return

    setInput('')
    const userMessage: Message = { role: 'user', content: trimmed }
    const nextMessages: Message[] = [...messages, userMessage]
    setMessages(nextMessages)
    setIsThinking(true)

    try {
      const imagePrompt =
        trimmed.toLowerCase().startsWith('/image ')
          ? trimmed.slice(7).trim()
          : trimmed.toLowerCase().startsWith('/img ')
            ? trimmed.slice(5).trim()
            : null
      if (imagePrompt) {
        const image = await generateImage({
          prompt: imagePrompt,
          modelName: selectedImageModel,
        })
        const imageResponse = `Generated with \`${selectedImageModel}\`\n\n![${imagePrompt}](${image.dataUrl})`
        setMessages((prev) => [...prev, { role: 'assistant', content: imageResponse }])
        return
      }

      const goalData = goalsToConciergeRows(goals)

      const conversation = nextMessages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n')

      // Add streaming placeholder
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      let accumulated = ''
      const { text: aiResponse } = await callAIStream({
        prompt: generateHomeConciergePrompt(goalData, conversation),
        systemPrompt: conciergeSystemPrompt,
        temperature: 0.55,
        maxOutputTokens: 200,
        modelName: selectedModel,
        onChunk: (piece) => {
          accumulated += piece
          const displayText = accumulated.replace(NAVIGATE_REGEX, '').trim()
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: displayText }
            return updated
          })
        },
      })

      // Final: extract nav signal and clean
      const navMatch = aiResponse.match(NAVIGATE_REGEX)
      const cleanResponse = aiResponse.replace(NAVIGATE_REGEX, '').trim()
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: cleanResponse }
        return updated
      })

      if (navMatch) {
        const goalId = navMatch[1]
        setPendingNavGoalId(goalId)
      }
    } catch (e) {
      const fallback = "Sorry, I couldn't connect right now. Try again in a moment!"
      const content = isVertexRateLimitError(e) ? VERTEX_RATE_LIMIT_USER_MESSAGE : fallback
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === 'assistant' && last.content === '') {
          next[next.length - 1] = { role: 'assistant', content }
          return next
        }
        return [...next, { role: 'assistant', content }]
      })
    } finally {
      setIsThinking(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const suggestions = buildGoalSuggestions(goals)
  const pendingGoal = pendingNavGoalId
    ? goals.find((g) => g.id === pendingNavGoalId) ?? null
    : null
  const pendingNewGoalFlow =
    pendingNavGoalId === NAVIGATE_NEW_GOAL && pendingGoal === null

  const homeMarkdownClass =
    "space-y-4 [&>p]:text-[1.0625rem] sm:[&>p]:text-[1.125rem] [&>p]:leading-[1.7] [&>ul]:space-y-2 [&>ol]:space-y-2 [&>ul]:ml-6 [&>ol]:ml-6 [&>h1]:text-xl [&>h1]:mt-6 [&>h1]:mb-2 [&>h2]:text-lg [&>h2]:mt-5 [&>h2]:mb-2 [&>h3]:text-base [&>h3]:font-semibold [&>blockquote]:pl-4 [&_table]:text-[0.95rem] sm:[&_table]:text-base [&_pre]:text-sm"

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 pb-[calc(env(safe-area-inset-bottom)+3.5rem)] sm:pb-0">
      {/* Messages area — roomy layout, larger type for a calmer read */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8 pb-32">
        <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
          {messages.map((msg, i) => {
            const isAssistantStreamingShell =
              msg.role === 'assistant' &&
              msg.content === '' &&
              isThinking &&
              i === messages.length - 1

            return (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-200`}
              >
                {msg.role === 'assistant' && (
                  <div className="h-10 w-10 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 mr-3.5 mt-1">
                    <Sparkles className="h-4 w-4 text-brand" />
                  </div>
                )}
                {msg.role === 'assistant' ? (
                  <div
                    className="flex-1 min-w-0 text-[1.0625rem] sm:text-[1.125rem] leading-[1.7] text-foreground py-1"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {isAssistantStreamingShell ? (
                      <div className="flex items-center gap-2 py-3" aria-hidden>
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                      </div>
                    ) : (
                      <Markdown content={msg.content} className={homeMarkdownClass} />
                    )}
                  </div>
                ) : (
                  /* User: large radius reads as a pill for long text but won't collapse to a circle on narrow widths */
                  <div
                    className="max-w-[min(88%,32rem)] rounded-[1.35rem] px-5 py-3.5 text-[1.0625rem] sm:text-[1.125rem] leading-[1.65] bg-brand-muted text-foreground text-left border border-brand/25 dark:border-brand/35 shadow-sm shadow-black/6 dark:shadow-black/25"
                    style={{ wordBreak: 'break-word' }}
                  >
                    <span className="whitespace-pre-wrap block">{msg.content}</span>
                  </div>
                )}
              </div>
            )
          })}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Goal Suggestion Chips */}
      {suggestions.length > 0 && messages.length <= 1 && (
        <div className="px-5 sm:px-8 pb-3">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2.5">
            {suggestions.map((s) => (
              <button
                key={s.goalId}
                onClick={() => navigate({ to: '/plan/$goalId', params: { goalId: s.goalId } })}
                className="text-sm font-semibold px-4 py-2.5 rounded-full border border-border/80 bg-card hover:bg-muted hover:border-brand/40 transition-all duration-150 flex items-center gap-2 max-w-[280px] truncate"
              >
                <span className="truncate">{s.label}</span>
                <span className="text-muted-foreground shrink-0">{s.progress}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending navigation confirmation */}
      {pendingNewGoalFlow && (
        <div className="px-5 sm:px-8 pb-4">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border/70 bg-card/95 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
              <div>
                {isNavigatingGoal ? (
                  <>
                    <p className="text-base font-semibold leading-snug">Starting new goal…</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Opening the planner so you can shape your plan.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-semibold leading-snug">Create a new goal?</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      I can take you to the guided flow to define what you want and build a plan.
                    </p>
                  </>
                )}
              </div>
              <div className="flex gap-2.5 justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (isNavigatingGoal) return
                    setPendingNavGoalId(null)
                  }}
                  className="h-10 px-4 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  disabled={isNavigatingGoal}
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isNavigatingGoal) return
                    setIsNavigatingGoal(true)
                    setTimeout(() => {
                      setPendingNavGoalId(null)
                      setIsNavigatingGoal(false)
                      navigate({ to: '/new-goal' })
                    }, 800)
                  }}
                  className="h-10 px-4 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-60"
                  disabled={isNavigatingGoal}
                >
                  {isNavigatingGoal ? 'Opening…' : 'Start new goal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingGoal && (
        <div className="px-5 sm:px-8 pb-4">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border/70 bg-card/95 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
              <div>
                {isNavigatingGoal ? (
                  <>
                    <p className="text-base font-semibold leading-snug">
                      Opening “{pendingGoal.title}”…
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Loading your plan. This will just take a moment.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-semibold leading-snug">
                      Continue with “{pendingGoal.title}”?
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      I can open its plan so you can jump back into it.
                    </p>
                  </>
                )}
              </div>
              <div className="flex gap-2.5 justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (isNavigatingGoal) return
                    setPendingNavGoalId(null)
                  }}
                  className="h-10 px-4 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  disabled={isNavigatingGoal}
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!pendingGoal?.id || isNavigatingGoal) return
                    setIsNavigatingGoal(true)
                    const goalId = pendingGoal.id
                    setTimeout(() => {
                      setPendingNavGoalId(null)
                      setIsNavigatingGoal(false)
                      navigate({ to: '/plan/$goalId', params: { goalId } })
                    }, 1500)
                  }}
                  className="h-10 px-4 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-60"
                  disabled={isNavigatingGoal}
                >
                  {isNavigatingGoal ? 'Opening…' : 'Open plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating input */}
      <div className="sticky bottom-0 px-5 sm:px-8 pb-3 sm:pb-6 pt-2 bg-linear-to-t from-background via-background/95 to-transparent">
        <div className="max-w-3xl mx-auto">
          <div data-tour-id="home-chat-input" className="flex items-end gap-3 rounded-[1.35rem] border border-border/70 bg-card/95 backdrop-blur-md shadow-lg shadow-black/5 px-4 py-3 focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/15 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message Duwit…"
            rows={1}
            className="flex-1 resize-none bg-transparent px-1 py-1 text-base outline-none placeholder:text-muted-foreground/55 min-h-[44px] max-h-[140px] leading-[1.55]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="h-11 w-11 rounded-2xl bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}
