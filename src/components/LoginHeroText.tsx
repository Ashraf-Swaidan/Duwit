import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"

const SUBTITLE = "Duwit turns ambition into a path you can walk."

/** Two-line beats: typed out, held, then deleted — loops forever (unless reduced motion). */
const PHRASES = [
  { line1: "Turn goals", line2: "into done." },
  { line1: "Learn", line2: "as you go." },
  { line1: "Quiet", line2: "wins stack." },
  { line1: "Your plan", line2: "stays with you." },
] as const

/** One display font per phrase — cycles with the typewriter (loaded in index.html). */
const PHRASE_FONTS = [
  { family: "'Fraunces', Georgia, serif", tracking: "tracking-[-0.05em]" },
  { family: "'Oswald', system-ui, sans-serif", tracking: "tracking-[0.04em]" },
  { family: "'Playfair Display', Georgia, serif", tracking: "tracking-[-0.02em]" },
  { family: "'Syne', system-ui, sans-serif", tracking: "tracking-[-0.06em]" },
] as const

type Step = "t1" | "t2" | "hold" | "d2" | "d1"

/**
 * Login art panel: autonomous typewriter loop on two gradient lines + ambient sheen,
 * with a different display font each phrase.
 */
export function LoginHeroText() {
  const [reduceMotion, setReduceMotion] = useState(false)
  const [line1, setLine1] = useState("")
  const [line2, setLine2] = useState("")
  /** Which phrase’s font + tracking to use (synced when the loop advances). */
  const [phraseFontIdx, setPhraseFontIdx] = useState(0)
  /** Increments on each font swap so motion can fade without treating phrase 0 as “first load”. */
  const [fontMotionKey, setFontMotionKey] = useState(0)
  /** Where the caret sits while typing / deleting. */
  const [caretLine, setCaretLine] = useState<1 | 2>(1)

  const phraseIdxRef = useRef(0)
  const stepRef = useRef<Step>("t1")
  const posRef = useRef(0)
  const timeoutRef = useRef<number>(0)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    if (reduceMotion) {
      const p = PHRASES[0]
      setLine1(p.line1)
      setLine2(p.line2)
      return
    }

    const TYPE_MS = 46
    const BETWEEN_LINES_MS = 280
    const DELETE_MS = 34
    const HOLD_MS = 2600
    const BETWEEN_PHRASES_MS = 400

    const clearTimer = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = 0
      }
    }

    const schedule = (fn: () => void, ms: number) => {
      clearTimer()
      timeoutRef.current = window.setTimeout(fn, ms)
    }

    const tick = () => {
      const idx = phraseIdxRef.current
      const p = PHRASES[idx]
      const step = stepRef.current

      if (step === "t1") {
        const pos = posRef.current
        if (pos < p.line1.length) {
          posRef.current = pos + 1
          setLine1(p.line1.slice(0, posRef.current))
          setCaretLine(1)
          schedule(tick, TYPE_MS)
        } else {
          stepRef.current = "t2"
          posRef.current = 0
          schedule(tick, BETWEEN_LINES_MS)
        }
        return
      }

      if (step === "t2") {
        const pos = posRef.current
        if (pos < p.line2.length) {
          posRef.current = pos + 1
          setLine2(p.line2.slice(0, posRef.current))
          setCaretLine(2)
          schedule(tick, TYPE_MS)
        } else {
          stepRef.current = "hold"
          posRef.current = 0
          setCaretLine(2)
          schedule(tick, HOLD_MS)
        }
        return
      }

      if (step === "hold") {
        stepRef.current = "d2"
        posRef.current = p.line2.length
        schedule(tick, DELETE_MS)
        return
      }

      if (step === "d2") {
        const pos = posRef.current
        if (pos > 0) {
          posRef.current = pos - 1
          setLine2(p.line2.slice(0, posRef.current))
          setCaretLine(2)
          schedule(tick, DELETE_MS)
        } else {
          stepRef.current = "d1"
          posRef.current = p.line1.length
          schedule(tick, DELETE_MS)
        }
        return
      }

      if (step === "d1") {
        const pos = posRef.current
        if (pos > 0) {
          posRef.current = pos - 1
          setLine1(p.line1.slice(0, posRef.current))
          setCaretLine(1)
          schedule(tick, DELETE_MS)
        } else {
          phraseIdxRef.current = (phraseIdxRef.current + 1) % PHRASES.length
          setPhraseFontIdx(phraseIdxRef.current)
          setFontMotionKey((k) => k + 1)
          stepRef.current = "t1"
          posRef.current = 0
          setLine2("")
          setCaretLine(1)
          schedule(tick, BETWEEN_PHRASES_MS)
        }
      }
    }

    setLine1("")
    setLine2("")
    phraseIdxRef.current = 0
    stepRef.current = "t1"
    posRef.current = 0
    tick()

    return () => {
      clearTimer()
    }
  }, [reduceMotion])

  const fontMeta = PHRASE_FONTS[reduceMotion ? 0 : phraseFontIdx]

  const headline = (
    <>
      {!reduceMotion && (
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl"
          aria-hidden
        >
          <div className="login-hero-sheen absolute inset-y-[-20%] left-0 w-[45%] min-w-20 bg-linear-to-r from-transparent via-white/35 to-transparent opacity-80 mix-blend-soft-light dark:via-white/14 dark:opacity-90" />
        </div>
      )}
      <motion.div
        key={reduceMotion ? "static" : fontMotionKey}
        initial={reduceMotion || fontMotionKey === 0 ? false : { opacity: 0.38 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.38, ease: "easeOut" }}
        className={`relative z-10 min-h-[2.4em] font-black uppercase leading-[0.86] select-none sm:min-h-[2.6em] ${fontMeta.tracking}`}
        style={{ fontFamily: fontMeta.family }}
        aria-hidden
      >
        <span className="block bg-linear-to-br from-brand via-foreground to-chart-2 bg-clip-text text-transparent text-[clamp(2rem,min(11vw,6.5rem),6.5rem)]">
          {line1}
          {!reduceMotion && caretLine === 1 && (
            <span
              className="ml-1 inline-block h-[0.65em] w-[0.18em] min-w-[3px] animate-pulse rounded-sm bg-brand align-baseline opacity-90"
              aria-hidden
            />
          )}
        </span>
        <span className="mt-1 block min-h-[1.15em] bg-linear-to-tr from-chart-3 via-brand to-foreground bg-clip-text text-transparent text-[clamp(2rem,min(11vw,6.5rem),6.5rem)]">
          {line2}
          {!reduceMotion && caretLine === 2 && (
            <span
              className="ml-1 inline-block h-[0.65em] w-[0.18em] min-w-[3px] animate-pulse rounded-sm bg-brand align-baseline opacity-90"
              aria-hidden
            />
          )}
        </span>
      </motion.div>
    </>
  )

  return (
    <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col">
      <p className="sr-only">
        Animated headline cycles through short phrases about goals, learning, and momentum. The
        display font changes with each phrase.
      </p>
      {/* Typewriter only: fills space above the tagline and stays vertically centered in this band.
          Tagline is a separate row so it does not move when headline height/font changes. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 pt-10 pb-2 sm:px-8 sm:pt-12 lg:pt-16">
        <div className="relative w-full max-w-[min(100%,28rem)] text-center">
          <div className="relative origin-center">{headline}</div>
        </div>
      </div>

      <p className="relative z-10 mx-auto max-w-xs shrink-0 px-5 pb-10 pt-4 text-center text-sm font-medium leading-relaxed text-foreground/85 dark:text-foreground/80 sm:px-8 sm:pb-12">
        {SUBTITLE}
      </p>
    </div>
  )
}
