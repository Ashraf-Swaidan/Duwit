import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { auth } from "@/lib/firebase"
import { getUserGoals } from "@/services/goals"
import { useQuery } from '@tanstack/react-query'
import {
  buildContextHash,
  buildInstantGreeting,
  buildGoalSuggestions,
  loadCachedGreeting,
  saveCachedGreeting,
  type CachedGreeting,
} from "@/services/userContext"
import { callAI } from "@/services/ai"
import { HOME_CONCIERGE_SYSTEM_PROMPT, generateHomeConciergePrompt } from "@/services/prompts"
import { Send, Sparkles } from 'lucide-react'

export const Route = createFileRoute('/')(({
  component: HomePage,
}))

interface Message {
  role: 'assistant' | 'user'
  content: string
}

const NAVIGATE_REGEX = /\[NAVIGATE:([^\]]+)\]/

function HomePage() {
  const user = auth.currentUser
  const navigate = useNavigate()
  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  const { data: goals = [] } = useQuery({
    queryKey: ['goals', user?.uid],
    queryFn: () => (user ? getUserGoals(user.uid) : Promise.resolve([])),
    enabled: !!user,
  })

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [greetingReady, setGreetingReady] = useState(false)
  const greetingSeedRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ─── Boot: show greeting on goals load ───────────────────────────────────
  useEffect(() => {
    if (goals.length === 0 && !greetingReady) {
      // For users with no goals, show a generic welcome immediately
      setMessages([{
        role: 'assistant',
        content: `Hey ${firstName}! 👋 I'm Duwit, your personal growth assistant.\n\nWhat's a goal you've been meaning to work on? I'll build you a personalised plan.`,
      }])
      setGreetingReady(true)
      return
    }

    if (goals.length > 0 && !greetingReady) {
      initGreeting()
    }
  }, [goals, greetingReady]) // eslint-disable-line react-hooks/exhaustive-deps

  async function initGreeting() {
    setGreetingReady(true)

    // 1. Show instant template greeting right away
    const instant = buildInstantGreeting(firstName, goals)
    greetingSeedRef.current = instant
    setMessages([{ role: 'assistant', content: instant }])

    if (!user) return

    // 2. Check if cached AI greeting is still valid
    const hash = buildContextHash(goals)
    let cached: CachedGreeting | null = null
    try {
      cached = await loadCachedGreeting(user.uid)
    } catch (_) { /* network error, continue */ }

    if (cached && cached.contextHash === hash) {
      // Cache still valid — swap in the AI greeting
      const twelveHoursMs = 12 * 60 * 60 * 1000
      if (Date.now() - new Date(cached.generatedAt).getTime() < twelveHoursMs) {
        setMessages((prev) => {
          if (prev.length !== 1) return prev
          if (prev[0]?.role !== 'assistant') return prev
          if (greetingSeedRef.current && prev[0].content !== greetingSeedRef.current) return prev
          return [{ role: 'assistant', content: cached.message }]
        })
        return
      }
    }

    // 3. Context changed — ask AI for a fresh greeting in the background
    try {
      const goalData = goals.map((g) => ({
        id: g.id!,
        title: g.title,
        progress: g.progress ?? 0,
      }))
      const greetingPrompt = generateHomeConciergePrompt(goalData, `The user just opened the app. Generate a warm, personalised greeting (2-3 sentences) that:\n- Acknowledges their most in-progress or recently active goal\n- Suggests they continue it or asks what they'd like to focus on today\n- Feels conversational, not scripted`)
      const aiGreeting = await callAI({
        prompt: greetingPrompt,

        systemPrompt: HOME_CONCIERGE_SYSTEM_PROMPT,
        temperature: 0.8,
        maxOutputTokens: 150,
      })

      const cleanGreeting = aiGreeting.replace(NAVIGATE_REGEX, '').trim()
      setMessages((prev) => {
        if (prev.length !== 1) return prev
        if (prev[0]?.role !== 'assistant') return prev
        if (greetingSeedRef.current && prev[0].content !== greetingSeedRef.current) return prev
        return [{ role: 'assistant', content: cleanGreeting }]
      })

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

  // ─── Send a message ───────────────────────────────────────────────────────
  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isThinking) return

    setInput('')
    const userMessage: Message = { role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMessage])
    setIsThinking(true)

    try {
      const goalData = goals.map((g) => ({
        id: g.id!,
        title: g.title,
        progress: g.progress ?? 0,
      }))

      const aiResponse = await callAI({
        prompt: generateHomeConciergePrompt(goalData, trimmed),
        systemPrompt: HOME_CONCIERGE_SYSTEM_PROMPT,
        temperature: 0.7,
        maxOutputTokens: 200,
      })

      // Check if AI wants to navigate
      const navMatch = aiResponse.match(NAVIGATE_REGEX)
      const cleanResponse = aiResponse.replace(NAVIGATE_REGEX, '').trim()

      setMessages((prev) => [...prev, { role: 'assistant', content: cleanResponse }])

      if (navMatch) {
        const goalId = navMatch[1]
        setTimeout(() => {
          navigate({ to: '/plan/$goalId', params: { goalId } })
        }, 900)
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't connect right now. Try again in a moment!" },
      ])
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

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-4 pb-28">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="h-8 w-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 mr-2.5 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-brand" />
                </div>
              )}
              <div
                className={`rounded-3xl px-4 py-3 max-w-[82%] text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-brand text-white rounded-br-lg'
                    : 'bg-muted rounded-bl-lg'
                }`}
                style={{ wordBreak: 'break-word' }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-start">
              <div className="h-8 w-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 mr-2.5 mt-0.5">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
              </div>
              <div className="rounded-3xl rounded-bl-lg bg-muted px-4 py-3 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Goal Suggestion Chips */}
      {suggestions.length > 0 && messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="max-w-2xl mx-auto flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.goalId}
                onClick={() => navigate({ to: '/plan/$goalId', params: { goalId: s.goalId } })}
                className="text-xs font-semibold px-3.5 py-2 rounded-full border border-border/80 bg-card hover:bg-muted hover:border-brand/40 transition-all duration-150 flex items-center gap-1.5 max-w-[260px] truncate"
              >
                <span className="truncate">{s.label}</span>
                <span className="text-muted-foreground shrink-0">{s.progress}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating input */}
      <div className="sticky bottom-0 px-4 pb-5 pt-2 bg-linear-to-t from-background via-background/95 to-transparent">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 rounded-3xl border border-border/70 bg-card/95 backdrop-blur-md shadow-lg shadow-black/5 px-3.5 py-2.5 focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/15 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message Duwit…"
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground/60 min-h-[42px] max-h-[120px] leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="h-[42px] w-[42px] rounded-2xl bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}
