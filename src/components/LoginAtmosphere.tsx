import { useEffect, useState } from "react"
import { motion } from "motion/react"

type LoginAtmosphereProps = {
  /** `viewport` = fixed full-screen; `container` = fills a positioned parent (e.g. split art column). */
  scope?: "viewport" | "container"
}

/**
 * Decorative login background: layered gradients + animated blobs that gently
 * react to pointer position. Respects `prefers-reduced-motion`.
 */
export function LoginAtmosphere({ scope = "viewport" }: LoginAtmosphereProps) {
  const [reduceMotion, setReduceMotion] = useState(false)
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    if (reduceMotion) return
    const onMove = (e: PointerEvent) => {
      setPointer({
        x: e.clientX / Math.max(window.innerWidth, 1),
        y: e.clientY / Math.max(window.innerHeight, 1),
      })
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [reduceMotion])

  const dx = (pointer.x - 0.5) * 48
  const dy = (pointer.y - 0.5) * 40

  const floatTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 8, ease: "easeInOut" as const, repeat: Infinity, repeatType: "reverse" as const }

  const blob = (vw: number, maxPx: number) =>
    scope === "container" ? `min(${vw * 0.85}vw, ${Math.round(maxPx * 0.85)}px)` : `min(${vw}vw, ${maxPx}px)`

  const rootClass =
    scope === "viewport"
      ? "pointer-events-none fixed inset-0 z-0 overflow-hidden"
      : "pointer-events-none absolute inset-0 z-0 overflow-hidden"

  return (
    <div className={rootClass} aria-hidden>
      {/* Base wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_60%_at_50%_-18%,oklch(0.72_0.16_55/0.22),transparent_65%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_75%,oklch(0.78_0.12_280/0.18),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_45%,oklch(0.65_0.14_200/0.14),transparent_48%)]" />
      <div className="absolute inset-0 bg-linear-to-br from-brand-muted/30 via-transparent to-chart-3/15 opacity-90 dark:from-brand-muted/20 dark:to-chart-3/10" />

      {/* Parallax group */}
      <div
        className="absolute -inset-[12%] will-change-transform"
        style={{ transform: `translate3d(${dx}px, ${dy}px, 0)` }}
      >
        <motion.div
          className="absolute -left-[8%] top-[8%] rounded-full blur-3xl"
          style={{
            width: blob(52, 420),
            height: blob(52, 420),
            background:
              "radial-gradient(circle, oklch(0.72 0.16 55 / 0.45) 0%, oklch(0.78 0.12 70 / 0.15) 45%, transparent 70%)",
          }}
          animate={
            reduceMotion
              ? { opacity: 0.55, scale: 1 }
              : { opacity: [0.45, 0.65, 0.48], scale: [1, 1.06, 1] }
          }
          transition={floatTransition}
        />
        <motion.div
          className="absolute right-[-5%] bottom-[12%] rounded-full blur-3xl"
          style={{
            width: blob(48, 380),
            height: blob(48, 380),
            background:
              "radial-gradient(circle, oklch(0.62 0.18 280 / 0.35) 0%, oklch(0.55 0.12 250 / 0.12) 50%, transparent 72%)",
          }}
          animate={
            reduceMotion
              ? { opacity: 0.4, scale: 1 }
              : { opacity: [0.35, 0.52, 0.38], scale: [1.02, 1, 1.04] }
          }
          transition={{ ...floatTransition, duration: reduceMotion ? 0 : 10 }}
        />
        <motion.div
          className="absolute left-[28%] bottom-[0%] rounded-full blur-3xl"
          style={{
            width: blob(42, 320),
            height: blob(42, 320),
            background:
              "radial-gradient(circle, oklch(0.68 0.14 200 / 0.28) 0%, oklch(0.7 0.1 160 / 0.1) 48%, transparent 70%)",
          }}
          animate={
            reduceMotion
              ? { opacity: 0.35, scale: 1 }
              : { opacity: [0.3, 0.45, 0.32], scale: [1, 1.05, 0.98] }
          }
          transition={{ ...floatTransition, duration: reduceMotion ? 0 : 9.5 }}
        />
      </div>

      {/* Fine grain + vignette */}
      <div className="absolute inset-0 opacity-[0.4] mix-blend-overlay bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.35%22/%3E%3C/svg%3E')]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_50%,transparent_40%,oklch(0.99_0.01_75/0.55))] dark:bg-[radial-gradient(ellipse_80%_70%_at_50%_50%,transparent_35%,oklch(0.1_0.02_260/0.65))]" />
    </div>
  )
}
