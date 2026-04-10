import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { ArrowRight, BookOpen, Brain, ListChecks, MessageSquare, RefreshCw, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const DEMO_SCENARIOS = [
  { key: "learn" as const, label: "Certification exam" },
  { key: "habit" as const, label: "Writing habit" },
  { key: "ship" as const, label: "Side project" },
  { key: "health" as const, label: "Fitness goal" },
] as const

const SCENARIO_ROTATE_MS = 28_000
const WINDOWS_INSTALLER_PATH = "https://github.com/Ashraf-Swaidan/Duwit/releases/latest"
type ScenarioKey = (typeof DEMO_SCENARIOS)[number]["key"]

type Beat =
  | { kind: "section"; title: string }
  | { kind: "chat"; role: "user" | "assistant"; text: string }
  | { kind: "roadmap"; phaseTitle: string; taskTitles: string[] }
  | { kind: "taskOpen"; phaseTitle: string; taskTitle: string }
  | { kind: "quiz"; question: string; options: string[] }
  | { kind: "memory"; text: string }
  | { kind: "nextTask"; text: string }

function buildGenericResponse(scenario: ScenarioKey): string {
  switch (scenario) {
    case "learn":
      return `That's a great goal! Passing a certification exam is totally achievable if you stay consistent.\n\nA few ideas:\n- Look up popular study resources and practice tests online\n- Create a study routine that works for you\n- Join a community for accountability\n- Take regular breaks and don't burn out\n\nYou've got this — just believe in the process and take it one day at a time! 🙌`
    case "habit":
      return `Love this goal! Building a daily writing habit is such a powerful thing.\n\nSome tips that often help:\n- Start small — even just 5 minutes a day counts\n- Pick a consistent time that works for you\n- Don't worry about quality at first, just write freely\n- Use a habit tracker to stay motivated\n\nEvery author started where you are. You've got this — just keep showing up! ✨`
    case "ship":
      return `So exciting! Shipping something people pay for is absolutely within reach.\n\nThings to consider:\n- Research what's out there and find your angle\n- Talk to potential users to validate your idea\n- Start small and iterate based on feedback\n- Don't let perfect be the enemy of good enough\n\nThe best time to start was yesterday. Second best? Right now. You've got this! 🚀`
    case "health":
    default:
      return `What an inspiring goal! Getting fit for hiking is such a positive intention.\n\nGentle suggestions:\n- Start with easier trails and build up gradually\n- Listen to your body and rest when needed\n- Look into beginner fitness programs online\n- Celebrate every small improvement\n\nYou're already winning just by having this goal. Be kind to yourself and enjoy the journey! 💪`
  }
}

function buildDuwitJourney(scenario: ScenarioKey): Beat[] {
  switch (scenario) {
    case "learn":
      return [
        { kind: "section", title: "You tell Duwit your goal" },
        {
          kind: "chat",
          role: "assistant",
          text: "What do you want to achieve? Even rough is fine — I'll help shape it.",
        },
        { kind: "chat", role: "user", text: "I want to pass my CompTIA Network+ exam." },
        {
          kind: "chat",
          role: "assistant",
          text: "Got it. What's your biggest weak spot — subnetting, protocols, or security?",
        },
        { kind: "chat", role: "user", text: "Subnetting. I always lose track of the math." },
        {
          kind: "chat",
          role: "assistant",
          text: "Noted. Subnetting gets priority in your roadmap — each task on it will build real understanding, not just exposure.",
        },
        { kind: "section", title: "Duwit builds your roadmap" },
        {
          kind: "roadmap",
          phaseTitle: "Network fundamentals",
          taskTitles: ["The TCP/IP model", "Subnetting from scratch", "IPv4 vs IPv6"],
        },
        {
          kind: "roadmap",
          phaseTitle: "Security & protocols",
          taskTitles: ["Common ports and protocols", "Network threats and defenses"],
        },
        { kind: "section", title: "You open a task — Duwit teaches inside it" },
        { kind: "taskOpen", phaseTitle: "Network fundamentals", taskTitle: "Subnetting from scratch" },
        {
          kind: "chat",
          role: "assistant",
          text: "Subnetting is one question: how do you split an IP space into smaller chunks?\n\nA /24 means 24 bits are locked as the network. 8 bits remain for hosts — 2⁸ = 256 addresses, minus 2 reserved = 254 usable. The −2 is for the network address and broadcast. Neither can be assigned to a device.",
        },
        {
          kind: "chat",
          role: "user",
          text: "I get the 254 part, but how do I find the actual network address from a random IP?",
        },
        {
          kind: "chat",
          role: "assistant",
          text: "AND the IP with its subnet mask — bit by bit.\n\n192.168.5.130 with /24 (255.255.255.0) → AND them → 192.168.5.0. That's your network address. The host portion zeros out.\n\nWant to try one? What's the network address for 10.0.14.200 /27?",
        },
        {
          kind: "chat",
          role: "assistant",
          text: "Let's lock that in. One quick quiz question.",
        },
        {
          kind: "quiz",
          question: "How many usable host addresses are in a /26 subnet?",
          options: ["62", "64", "30", "126"],
        },
        {
          kind: "memory",
          text: "Quiz result saved: subnetting AND operation understood, /26 = 62 correct. Broadcast address confusion noted — next task will revisit.",
        },
        {
          kind: "nextTask",
          text: "\"IPv4 vs IPv6\" opens with Duwit already knowing you're solid on subnetting.",
        },
      ]

    case "habit":
      return [
        { kind: "section", title: "You tell Duwit your goal" },
        {
          kind: "chat",
          role: "assistant",
          text: "What habit do you want to build? Rough is fine — we'll shape it together.",
        },
        {
          kind: "chat",
          role: "user",
          text: "I want to write every day. Nothing too long — I just want it to actually stick.",
        },
        {
          kind: "chat",
          role: "assistant",
          text: "What usually kills it — the blank page, not having time, or feeling like it has to be good?",
        },
        { kind: "chat", role: "user", text: "The blank page. I overthink the first sentence and give up." },
        {
          kind: "chat",
          role: "assistant",
          text: "That's the most fixable one. Your roadmap is built around that specific block — not generic \"write more\" advice.",
        },
        { kind: "section", title: "Duwit builds your roadmap" },
        {
          kind: "roadmap",
          phaseTitle: "Break the blank page",
          taskTitles: ["Stream of consciousness writing", "The 5-minute commitment", "Writing from a single word"],
        },
        {
          kind: "roadmap",
          phaseTitle: "Make it stick",
          taskTitles: ["Anchoring to an existing habit", "The fallback session"],
        },
        { kind: "section", title: "You open a task — Duwit teaches inside it" },
        {
          kind: "taskOpen",
          phaseTitle: "Break the blank page",
          taskTitle: "Stream of consciousness writing",
        },
        {
          kind: "chat",
          role: "assistant",
          text: "Stream of consciousness has one rule: your cursor never stops. You don't delete. You don't reread until you're done.\n\nIt bypasses the editor in your head — the one that says \"bad sentence\" and freezes you. When the rule is \"never stop,\" there's nothing to judge yet.",
        },
        { kind: "chat", role: "user", text: "What if I literally have nothing to write about?" },
        {
          kind: "chat",
          role: "assistant",
          text: "Write \"I have nothing to say\" — literally. Then write why. Or describe the room.\n\nThe topic doesn't matter; the motion does. The first line is never what you actually write about. It's just the engine turning over.",
        },
        {
          kind: "chat",
          role: "assistant",
          text: "Quick question to make sure that landed.",
        },
        {
          kind: "quiz",
          question: "What's the core rule of stream of consciousness writing?",
          options: [
            "Never stop — no deleting, no rereading mid-session",
            "Write only when you have something meaningful to say",
            "Aim for at least 500 words per session",
            "Rewrite each sentence before moving on",
          ],
        },
        {
          kind: "memory",
          text: "Blank page identified as the core block. Stream of consciousness task done. Next task already knows — won't re-explain the technique.",
        },
        {
          kind: "nextTask",
          text: "\"The 5-minute commitment\" — Duwit knows the blank page is solved. It moves forward.",
        },
      ]

    case "ship":
      return [
        { kind: "section", title: "You tell Duwit your goal" },
        {
          kind: "chat",
          role: "assistant",
          text: "What do you want to build? Even a rough idea — I'll help sharpen it.",
        },
        { kind: "chat", role: "user", text: "Something small that people will actually pay for. Probably for developers." },
        {
          kind: "chat",
          role: "assistant",
          text: "What specific pain — something developers already complain about or pay to avoid?",
        },
        { kind: "chat", role: "user", text: "Writing documentation. Everyone hates it and it always falls behind." },
        {
          kind: "chat",
          role: "assistant",
          text: "Real pain with real money behind it. Roadmap: understand who pays → define what they'd buy → build the smallest version that proves it.",
        },
        { kind: "section", title: "Duwit builds your roadmap" },
        {
          kind: "roadmap",
          phaseTitle: "Know your customer",
          taskTitles: ["Define your one customer", "The jobs-to-be-done interview", "What they already pay for"],
        },
        {
          kind: "roadmap",
          phaseTitle: "Build and ship",
          taskTitles: ["The one-page pitch", "The boring MVP", "Your first 10 users"],
        },
        { kind: "section", title: "You open a task — Duwit teaches inside it" },
        { kind: "taskOpen", phaseTitle: "Know your customer", taskTitle: "Define your one customer" },
        {
          kind: "chat",
          role: "assistant",
          text: "\"Developers\" is too broad to build for. You need one specific person in a specific situation.\n\nTry this frame: \"A [role] at a [company type] who [situation] and is frustrated by [specific friction].\"\n\nExample: a backend engineer at a 10–50 person startup who ships features fast and dreads the docs ticket after every PR.",
        },
        {
          kind: "chat",
          role: "user",
          text: "What if my guess is wrong? What if that's not who actually buys?",
        },
        {
          kind: "chat",
          role: "assistant",
          text: "You probably will be slightly wrong — that's the point. A wrong specific guess is more useful than a right vague one, because you can actually talk to that specific person.\n\nA vague customer has no phone number. A specific one does.",
        },
        { kind: "chat", role: "assistant", text: "One check before the next task." },
        {
          kind: "quiz",
          question: "Why is a specific customer definition more useful than a broad one?",
          options: [
            "You can find them, talk to them, and test assumptions",
            "It limits scope and lowers financial risk",
            "Investors always prefer narrow targeting",
            "It makes the landing page easier to write",
          ],
        },
        {
          kind: "memory",
          text: "Customer hypothesis stored: backend engineers at small startups, post-PR docs friction. Carried into the pitch and MVP tasks.",
        },
        {
          kind: "nextTask",
          text: "\"The jobs-to-be-done interview\" — Duwit has your hypothesis. It will push you to validate it, not redefine it.",
        },
      ]

    case "health":
    default:
      return [
        { kind: "section", title: "You tell Duwit your goal" },
        { kind: "chat", role: "assistant", text: "What's your fitness goal? Tell me what you're working toward." },
        {
          kind: "chat",
          role: "user",
          text: "I want to get strong enough to actually enjoy hiking — steep trails without my legs giving out.",
        },
        {
          kind: "chat",
          role: "assistant",
          text: "Any constraints — injuries, equipment, or how often you can train?",
        },
        { kind: "chat", role: "user", text: "Old knee injury. Nothing chronic, but it flares on long descents." },
        {
          kind: "chat",
          role: "assistant",
          text: "Important — I'll fold that into how we approach leg work. Your roadmap will prioritize patterns that load the knee safely.",
        },
        { kind: "section", title: "Duwit builds your roadmap" },
        {
          kind: "roadmap",
          phaseTitle: "Movement foundations",
          taskTitles: ["The squat and hinge pattern", "Single-leg stability", "Knee-safe descent mechanics"],
        },
        {
          kind: "roadmap",
          phaseTitle: "Trail endurance",
          taskTitles: ["Building your aerobic base", "Load and recovery you can repeat"],
        },
        { kind: "section", title: "You open a task — Duwit teaches inside it" },
        { kind: "taskOpen", phaseTitle: "Movement foundations", taskTitle: "The squat and hinge pattern" },
        {
          kind: "chat",
          role: "assistant",
          text: "Squats and hinges are two different patterns, both essential for hiking.\n\nThe squat is knee-dominant — think sitting into a chair. The hinge is hip-dominant — think pushing hips back to pick something up.\n\nFor your knee, the hinge is lower-risk to start. It loads the hip and hamstring more than the knee joint.",
        },
        { kind: "chat", role: "user", text: "Should I avoid squatting entirely because of my knee?" },
        {
          kind: "chat",
          role: "assistant",
          text: "Not avoid — modify. A box squat (sitting back to a surface) limits forward knee travel. A goblet squat with a counterweight helps you sit upright, reducing knee load.\n\nThe goal isn't to skip the pattern. It's to load it at a level your knee can handle, then build from there.",
        },
        { kind: "chat", role: "assistant", text: "Quick check on what you just learned." },
        {
          kind: "quiz",
          question: "Which movement is generally lower-risk for someone with knee sensitivity?",
          options: [
            "The hip hinge — loads hamstring and hip more than the knee",
            "The squat — more natural movement pattern",
            "Both are equally risky to start",
            "Neither — avoid loaded movements entirely",
          ],
        },
        {
          kind: "memory",
          text: "Old knee injury noted — flares on descents. Squat/hinge distinction understood. Next task will apply knee-safe variations throughout.",
        },
        {
          kind: "nextTask",
          text: "\"Single-leg stability\" — Duwit carries your knee history forward.",
        },
      ]
  }
}

function useTypingAnimation(fullText: string, runKey: number, cps = 42) {
  const [shown, setShown] = useState("")

  useEffect(() => {
    setShown("")
    if (!fullText) return
    let i = 0
    const tick = Math.max(8, Math.floor(1000 / cps))
    const id = window.setInterval(() => {
      i += 1
      setShown(fullText.slice(0, Math.min(i, fullText.length)))
      if (i >= fullText.length) window.clearInterval(id)
    }, tick)
    return () => window.clearInterval(id)
  }, [fullText, runKey, cps])

  return shown
}

function useStaggerReveal(totalSteps: number, runKey: number, stepMs = 180) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    setStep(0)
    if (totalSteps <= 1) return
    let ticks = 0
    const id = window.setInterval(() => {
      ticks += 1
      setStep(ticks)
      if (ticks >= totalSteps - 1) window.clearInterval(id)
    }, stepMs)
    return () => window.clearInterval(id)
  }, [runKey, totalSteps, stepMs])

  return step
}

function DuwitJourneyPanel({ beats, staggerStep }: { beats: Beat[]; staggerStep: number }) {
  let idx = 0
  const reveal = () => {
    const i = idx
    idx += 1
    return staggerStep >= i
  }

  return (
    <div className="space-y-3">
      {beats.map((beat, bi) => {
        const show = reveal()
        const key = `${bi}-${beat.kind}`

        if (beat.kind === "section") {
          return (
            <p
              key={key}
              className={cn(
                "text-[0.65rem] font-bold uppercase tracking-wider text-brand/80 pt-2 first:pt-0 transition-all duration-300",
                show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
              )}
            >
              {beat.title}
            </p>
          )
        }

        if (beat.kind === "chat") {
          const isUser = beat.role === "user"
          return (
            <div
              key={key}
              className={cn(
                "flex transition-all duration-300",
                isUser ? "justify-end" : "justify-start",
                show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
              )}
            >
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  isUser
                    ? "bg-brand text-white rounded-br-md"
                    : "bg-muted/80 text-foreground rounded-bl-md border border-border/60",
                )}
              >
                {!isUser && (
                  <span className="mb-1 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-brand">
                    <Sparkles className="h-3 w-3" /> Duwit
                  </span>
                )}
                <span className="whitespace-pre-wrap">{beat.text}</span>
              </div>
            </div>
          )
        }

        if (beat.kind === "roadmap") {
          return (
            <div
              key={key}
              className={cn(
                "rounded-2xl border border-border/60 bg-background/80 px-3.5 py-3 transition-all duration-300",
                show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
              )}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <ListChecks className="h-3.5 w-3.5 text-brand shrink-0" />
                {beat.phaseTitle}
              </div>
              <ul className="mt-2 space-y-1.5">
                {beat.taskTitles.map((t) => (
                  <li key={t} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="text-brand font-mono shrink-0">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        }

        if (beat.kind === "taskOpen") {
          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5 text-xs transition-all duration-300",
                show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
              )}
            >
              <BookOpen className="h-3.5 w-3.5 text-brand shrink-0" />
              <span className="text-muted-foreground shrink-0">Opened:</span>
              <span className="font-semibold text-foreground truncate">{beat.taskTitle}</span>
            </div>
          )
        }

        if (beat.kind === "quiz") {
          return (
            <div
              key={key}
              className={cn(
                "rounded-2xl border border-border/70 bg-card p-3.5 space-y-2.5 transition-all duration-300",
                show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
              )}
            >
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">In-app quiz</p>
              <p className="text-sm font-semibold leading-snug">{beat.question}</p>
              <div className="space-y-1.5">
                {beat.options.map((opt, oi) => (
                  <div
                    key={opt}
                    className="rounded-xl border border-border/80 bg-background/60 px-3 py-2 text-xs"
                  >
                    <span className="font-bold text-brand mr-2">{String.fromCharCode(65 + oi)}.</span>
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          )
        }

        if (beat.kind === "memory") {
          return (
            <div
              key={key}
              className={cn(
                "rounded-2xl border border-border/60 bg-muted/30 px-3.5 py-3 transition-all duration-300",
                show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
              )}
            >
              <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                <Brain className="h-3.5 w-3.5 text-brand shrink-0" />
                Duwit remembers
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">{beat.text}</p>
            </div>
          )
        }

        if (beat.kind === "nextTask") {
          return (
            <div
              key={key}
              className={cn(
                "rounded-xl border border-brand/30 bg-linear-to-r from-brand/10 to-transparent px-3.5 py-2.5 text-xs leading-relaxed transition-all duration-300",
                show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
              )}
            >
              <span className="font-semibold text-brand">Next task → </span>
              {beat.text}
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

export function InteractiveLandingPage() {
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [pauseDemoRotation, setPauseDemoRotation] = useState(false)
  const [runKey, setRunKey] = useState(0)

  const scenario = DEMO_SCENARIOS[scenarioIndex]
  const scenarioKey = scenario.key

  const genericFull = useMemo(() => buildGenericResponse(scenarioKey), [scenarioKey])
  const duwitJourney = useMemo(() => buildDuwitJourney(scenarioKey), [scenarioKey])

  const genericShown = useTypingAnimation(genericFull, runKey, 38)
  const staggerStep = useStaggerReveal(duwitJourney.length, runKey, 180)

  const bumpAnimation = useCallback(() => {
    setRunKey((k) => k + 1)
  }, [])

  const rerun = useCallback(() => bumpAnimation(), [bumpAnimation])

  useEffect(() => {
    if (pauseDemoRotation) return
    const id = window.setInterval(() => {
      setScenarioIndex((i) => (i + 1) % DEMO_SCENARIOS.length)
    }, SCENARIO_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [pauseDemoRotation])

  const skipFirstBump = useRef(true)
  useEffect(() => {
    if (skipFirstBump.current) {
      skipFirstBump.current = false
      return
    }
    bumpAnimation()
  }, [scenarioIndex, bumpAnimation])

  function selectScenario(index: number) {
    setPauseDemoRotation(true)
    setScenarioIndex(index)
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <span className="font-black text-lg tracking-tight">Duwit</span>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" asChild>
              <Link to="/login" search={{ redirect: undefined, mode: "login" }}>
                Sign in
              </Link>
            </Button>
            <Button size="sm" className="rounded-full px-4 font-semibold shadow-sm" asChild>
              <Link to="/login" search={{ redirect: undefined, mode: "signup" }}>
                Try now!
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/40">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.72_0.16_55/0.18),transparent)]" />
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
            {/* Hero */}
            <div className="max-w-2xl space-y-4 mb-10">
              <h1
                className="text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-4xl lg:text-[2.65rem] lg:leading-[1.05]"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
              >
                Other AIs leave you at the vague, optimistic talk. Duwit stays with you until you
                actually do it.
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {pauseDemoRotation
                  ? "Demo paused — pick a topic below or resume."
                  : "Demo rotates automatically — or pick a topic."}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {DEMO_SCENARIOS.map((ex, i) => (
                  <button
                    key={ex.key}
                    type="button"
                    onClick={() => selectScenario(i)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      scenarioIndex === i
                        ? "border-brand/50 bg-brand/10 text-foreground"
                        : "border-border/70 bg-muted/30 text-muted-foreground hover:border-brand/30 hover:text-foreground",
                    )}
                  >
                    {ex.label}
                  </button>
                ))}
                {pauseDemoRotation && (
                  <button
                    type="button"
                    onClick={() => setPauseDemoRotation(false)}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Resume
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  type="button"
                  size="lg"
                  className="rounded-full px-8 font-semibold gap-2 h-12"
                  asChild
                >
                  <Link to="/login" search={{ redirect: undefined, mode: "signup" }}>
                    Try now!
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-full px-6 h-12 font-semibold" asChild>
                  <Link to="/login" search={{ redirect: undefined, mode: "login" }}>
                    I already have an account
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" className="rounded-full px-6 h-12 font-semibold" asChild>
                  <a href={WINDOWS_INSTALLER_PATH} target="_blank" rel="noreferrer">
                    Download desktop (Windows)
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="rounded-full h-12 gap-2"
                  onClick={rerun}
                >
                  <RefreshCw className="h-4 w-4" />
                  Replay
                </Button>
              </div>
            </div>

            {/* Typical AI panel */}
            <div className="rounded-3xl border border-border/70 bg-card/40 p-5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/50 pb-3 mb-4">
                <MessageSquare className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
                <div>
                  <p className="text-sm font-bold">Typical AI</p>
                  <p className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
                    Encouragement · vague next steps
                  </p>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground min-h-36">
                {genericShown}
                {genericShown.length < genericFull.length && (
                  <span className="inline-block w-2 h-4 ml-0.5 align-[-2px] bg-brand/40 animate-pulse rounded-sm" />
                )}
              </p>
            </div>

            {/* Contrast separator */}
            <div className="flex items-start gap-4 py-6">
              <div className="h-px flex-1 bg-border/50 mt-3 shrink-0" />
              <div className="text-center max-w-xs shrink-0 px-2">
                <p className="text-sm font-bold text-foreground">That's where it ends.</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  No follow-through. No memory of what you said. No next step built around you.
                </p>
              </div>
              <div className="h-px flex-1 bg-border/50 mt-3 shrink-0" />
            </div>

            {/* Duwit panel */}
            <div className="rounded-3xl border border-brand/25 bg-linear-to-br from-brand-muted/25 via-card/80 to-card/40 p-5 shadow-md ring-1 ring-brand/10">
              <div className="flex items-center gap-2 border-b border-brand/15 pb-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-brand shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold">Duwit</p>
                  <p className="text-[0.7rem] font-medium uppercase tracking-wider text-brand/90">
                    Goal chat · roadmap · teach · quiz · remembers you
                  </p>
                </div>
              </div>

              <DuwitJourneyPanel beats={duwitJourney} staggerStep={staggerStep} />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 text-center border-t border-border/40">
          <h2
            className="text-xl font-semibold tracking-tight sm:text-2xl"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            Ready to work on a goal with a coach that stays in the thread?
          </h2>
          <p className="mt-3 max-w-md mx-auto text-sm text-muted-foreground leading-relaxed">
            Sign up, chat your goal, open tasks one at a time, and let Duwit teach, quiz, and
            remember — the same loop you just watched.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" className="rounded-full px-8 font-semibold h-12" asChild>
              <Link to="/login" search={{ redirect: undefined, mode: "signup" }}>
                Try now!
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-6 h-12 font-semibold" asChild>
              <Link to="/login" search={{ redirect: undefined, mode: "login" }}>
                I already have an account
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Duwit</p>
        <div className="mt-2 flex justify-center gap-4 flex-wrap">
          <Link to="/login" search={{ redirect: undefined, mode: "login" }} className="font-medium hover:text-foreground">
            Sign in
          </Link>
          <Link to="/login" search={{ redirect: undefined, mode: "signup" }} className="font-medium hover:text-foreground">
            Try now!
          </Link>
        </div>
      </footer>
    </div>
  )
}
