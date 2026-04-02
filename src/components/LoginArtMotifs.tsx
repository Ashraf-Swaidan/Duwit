import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { Layers, ListChecks, Map, MessageCircle, Sparkles, Target } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Light Duwit-themed ornament: goals, home chat, plan phases, tasks, path, coach sparkle.
 * Sits above gradients, below hero copy. Pointer-events none.
 */
export function LoginArtMotifs() {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  const drift = reduceMotion
    ? undefined
    : { y: [0, -7, 0] as const, rotate: [0, 1.5, 0] as const }

  const driftTransition = (delay: number, duration: number) => ({
    duration,
    delay,
    repeat: Infinity,
    ease: "easeInOut" as const,
  })

  const motifs: {
    Icon: typeof Target
    className: string
    delay: number
    duration: number
    size: string
  }[] = [
    { Icon: Target, className: "left-[6%] top-[12%]", delay: 0, duration: 6.2, size: "h-9 w-9 sm:h-11 sm:w-11" },
    { Icon: Sparkles, className: "right-[8%] top-[18%]", delay: 0.5, duration: 5.8, size: "h-8 w-8 sm:h-10 sm:w-10" },
    { Icon: MessageCircle, className: "left-[10%] bottom-[38%]", delay: 0.2, duration: 6.5, size: "h-8 w-8 sm:h-9 sm:w-9" },
    { Icon: Layers, className: "right-[14%] top-[42%]", delay: 0.8, duration: 5.4, size: "h-9 w-9 sm:h-10 sm:w-10" },
    { Icon: ListChecks, className: "left-[18%] top-[48%]", delay: 1.1, duration: 5.6, size: "h-7 w-7 sm:h-9 sm:w-9" },
    { Icon: Map, className: "right-[6%] bottom-[22%]", delay: 0.4, duration: 6.8, size: "h-8 w-8 sm:h-10 sm:w-10" },
  ]

  return (
    <div className="pointer-events-none absolute inset-0 z-1 overflow-hidden" aria-hidden>
      {/* Winding path: goal → chat → milestone (abstract “journey”) */}
      <svg
        className="absolute bottom-0 left-[-5%] h-[min(52%,280px)] w-[110%] text-brand/25 dark:text-brand/35"
        viewBox="0 0 520 140"
        preserveAspectRatio="none"
      >
        <path
          d="M-40 118 C90 20 200 130 280 48 S420 100 560 28"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="opacity-50"
        />
        <circle cx="72" cy="95" r="3.5" fill="currentColor" className="opacity-55" />
        <circle cx="268" cy="52" r="3.5" fill="currentColor" className="opacity-55" />
        <circle cx="420" cy="78" r="3.5" fill="currentColor" className="opacity-55" />
      </svg>

      {/* Second arc — top, lighter */}
      <svg
        className="absolute left-[-8%] top-[4%] h-[min(28%,160px)] w-[85%] text-brand/15 dark:text-brand/25"
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
      >
        <path
          d="M0 85 Q120 10 260 55 T400 25"
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="opacity-60"
        />
      </svg>

      {/* Faint mark — same asset as app chrome */}
      <img
        src="/logo.svg"
        alt=""
        className="absolute bottom-5 right-5 h-18 w-18 opacity-[0.06] saturate-0 sm:bottom-8 sm:right-8 sm:h-28 sm:w-28 dark:opacity-[0.09]"
      />

      {motifs.map(({ Icon, className, delay, duration, size }, i) => (
        <motion.div
          key={i}
          className={cn(
            "absolute text-brand/28 shadow-sm shadow-brand/5 dark:text-brand/35",
            className,
          )}
          animate={drift}
          transition={reduceMotion ? { duration: 0 } : driftTransition(delay, duration)}
        >
          <Icon className={cn(size)} strokeWidth={1.2} />
        </motion.div>
      ))}
    </div>
  )
}
