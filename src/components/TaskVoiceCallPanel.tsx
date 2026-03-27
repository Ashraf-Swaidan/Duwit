import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react"
import {
  getLiveGenerativeModel,
  ResponseModality,
  ThinkingLevel,
  AIError,
  AIErrorCode,
} from "firebase/ai"
import { PhoneOff, Phone, X, Loader2 } from "lucide-react"
import { ai } from "@/lib/firebase"
import { GEMINI_TTS_VOICE_NAME, resolveVoiceLiveModelId } from "@/config/geminiMedia"
import { useVoiceLiveModel } from "@/contexts/VoiceLiveModelContext"
import { startAudioConversationWithTranscripts } from "@/lib/liveAudioConversation"

type LiveVoiceController = Awaited<ReturnType<typeof startAudioConversationWithTranscripts>>

type TaskVoiceCallPanelProps = {
  open: boolean
  onClose: () => void
  systemInstruction: string
  onTranscriptDelta?: (evt: { role: "user" | "assistant"; text: string }) => void
}

type Phase = "idle" | "connecting" | "live" | "error"

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function playSpeakerChime(): Promise<void> {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return Promise.resolve()
  const ctx = new Ctor()
  return ctx
    .resume()
    .catch(() => undefined)
    .then(() => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22)
      osc.type = "sine"
      osc.frequency.value = 523.25
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.22)
      return new Promise<void>((resolve) => {
        osc.onended = () => {
          void ctx.close()
          resolve()
        }
      })
    })
}

function formatVoiceError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError") return "Microphone blocked — allow this site in the browser."
    if (e.name === "NotFoundError") return "No microphone found."
    if (e.name === "NotReadableError") return "Mic in use by another app."
    return e.message || "Microphone could not be opened."
  }
  if (e instanceof AIError) {
    if (e.code === AIErrorCode.UNSUPPORTED) {
      return "Voice needs Web Audio + AudioWorklet (try Chrome or Edge)."
    }
    if (e.code === AIErrorCode.SESSION_CLOSED) {
      return "Session closed before audio started."
    }
    return e.message
  }
  if (e instanceof Error) return e.message
  return "Could not start voice session."
}

function meterToneClasses(tone: "user" | "coach") {
  return tone === "user" ? "bg-emerald-400" : "bg-orange-400"
}

function VoiceMeterStyle() {
  return (
    <style>{`
      @keyframes voice-call-meter {
        0%, 100% { transform: scaleY(var(--meter-rest, 0.18)); }
        35% { transform: scaleY(var(--meter-peak, 0.72)); }
        68% { transform: scaleY(var(--meter-mid, 0.4)); }
      }
    `}</style>
  )
}

function LevelBars({
  level,
  tone,
  live,
}: {
  level: number
  tone: "user" | "coach"
  live: boolean
}) {
  const barClass = meterToneClasses(tone)
  const weights = [0.52, 0.86, 1.18, 0.86, 0.52]
  const intensity = clamp(level, 0, 1)
  const idleFloor = live ? 0.18 : 0.12

  return (
    <div
      className={`flex h-6 items-end gap-0.5 ${live ? "opacity-100" : "opacity-55"} transition-opacity duration-150`}
      aria-hidden
    >
      {weights.map((weight, i) => {
        const rest = Math.min(0.56, idleFloor + intensity * weight * 0.28)
        const mid = Math.min(0.76, idleFloor + intensity * weight * 0.56)
        const peak = Math.min(1, idleFloor + intensity * weight * 0.92)
        const meterStyle = {
          transform: `scaleY(${live ? rest : 0.2})`,
          opacity: live ? 0.78 + intensity * 0.22 : 0.4,
          filter: `saturate(${live ? 1 + intensity * 0.45 : 0.85}) brightness(${live ? 0.92 + intensity * 0.35 : 0.75})`,
          animation: live
            ? `voice-call-meter ${620 + i * 70}ms cubic-bezier(0.33, 1, 0.68, 1) infinite`
            : "none",
          animationDelay: `${i * 80}ms`,
          "--meter-rest": String(rest),
          "--meter-mid": String(mid),
          "--meter-peak": String(peak),
        } as CSSProperties & Record<"--meter-rest" | "--meter-mid" | "--meter-peak", string>

        return (
          <div key={i} className="relative h-6 w-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={`absolute inset-x-0 bottom-0 h-full origin-bottom rounded-full ${barClass} shadow-[0_0_10px_rgba(255,255,255,0.15)]`}
              style={meterStyle}
            />
          </div>
        )
      })}
    </div>
  )
}

function SpeakingDot({
  level,
  tone,
  live,
}: {
  level: number
  tone: "user" | "coach"
  live: boolean
}) {
  const intensity = clamp(level, 0, 1)
  const dotClass = meterToneClasses(tone)
  return (
    <span
      aria-hidden
      className={`block h-1.5 w-1.5 rounded-full ${dotClass} transition-[transform,opacity,box-shadow] duration-150`}
      style={{
        opacity: live ? 0.5 + intensity * 0.5 : 0.24,
        transform: `scale(${live ? 0.9 + intensity * 0.55 : 0.7})`,
        boxShadow: live ? `0 0 ${4 + intensity * 10}px currentColor` : "none",
      }}
    />
  )
}

function SignalCluster({
  label,
  level,
  tone,
  live,
}: {
  label: string
  level: number
  tone: "user" | "coach"
  live: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
      <span className="w-4 shrink-0 text-[8px] font-medium uppercase tracking-wider text-white/35 sm:w-5 sm:text-[9px]">
        {label}
      </span>
      <SpeakingDot level={level} tone={tone} live={live} />
      <LevelBars level={level} tone={tone} live={live} />
    </div>
  )
}

export function TaskVoiceCallPanel({
  open,
  onClose,
  systemInstruction,
  onTranscriptDelta,
}: TaskVoiceCallPanelProps) {
  const { voiceLiveModel } = useVoiceLiveModel()
  const [phase, setPhase] = useState<Phase>("idle")
  const [err, setErr] = useState<string | null>(null)
  const [inputLevel, setInputLevel] = useState(0)
  const [outputLevel, setOutputLevel] = useState(0)
  const controllerRef = useRef<LiveVoiceController | null>(null)

  const stop = useCallback(async () => {
    const c = controllerRef.current
    controllerRef.current = null
    if (c) await c.stop()
    setPhase("idle")
    setInputLevel(0)
    setOutputLevel(0)
  }, [])

  useEffect(() => {
    if (!open) {
      void stop()
    }
  }, [open, stop])

  async function startFromUserGesture() {
    setErr(null)
    setInputLevel(0)
    setOutputLevel(0)
    setPhase("connecting")
    try {
      const liveModelId = resolveVoiceLiveModelId(voiceLiveModel)
      const liveModel = getLiveGenerativeModel(ai, {
        model: liveModelId,
        generationConfig: {
          responseModalities: [ResponseModality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE_NAME } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          ...(voiceLiveModel === "gemini31FlashLive"
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
            : {}),
        },
        systemInstruction,
      })
      const session = await liveModel.connect()
      const controller = await startAudioConversationWithTranscripts(session, {
        onAudioLevels: ({ input, output }) => {
          setInputLevel(input)
          setOutputLevel(output)
        },
        onInputTranscription: (text) => {
          if (!text) return
          onTranscriptDelta?.({ role: "user", text })
        },
        onOutputTranscription: (text) => {
          if (!text) return
          onTranscriptDelta?.({ role: "assistant", text })
        },
      })
      controllerRef.current = controller
      setPhase("live")
      await playSpeakerChime()
    } catch (e) {
      setPhase("error")
      setErr(formatVoiceError(e))
    }
  }

  if (!open) return null

  const live = phase === "live"

  return (
    <>
      <VoiceMeterStyle />
      <div
        className="w-full animate-in fade-in slide-in-from-bottom-2 duration-200"
        role="dialog"
        aria-label="Voice call with coach"
      >
        <div className="rounded-[1.4rem] border border-border/80 bg-card px-3 py-2.5 shadow-lg shadow-black/5 backdrop-blur-sm sm:rounded-3xl sm:px-4 sm:py-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80 sm:text-[10px] sm:tracking-[0.18em]">
                  Voice coach
                </span>
                {phase === "connecting" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground sm:px-2 sm:py-1 sm:text-[10px]">
                    <Loader2 className="h-2.5 w-2.5 animate-spin sm:h-3 sm:w-3" aria-hidden />
                    Connecting
                  </span>
                )}
                {phase === "idle" && (
                  <span className="rounded-full border border-border/80 bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground sm:px-2 sm:py-1 sm:text-[10px]">
                    Ready
                  </span>
                )}
                {phase === "live" && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-300 sm:px-2 sm:py-1 sm:text-[10px]">
                    Live
                  </span>
                )}
                {phase === "error" && (
                  <span className="rounded-full border border-red-500/25 bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-600 dark:text-red-300 sm:px-2 sm:py-1 sm:text-[10px]">
                    Error
                  </span>
                )}
              </div>

              <div className="mt-2.5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:mt-3 sm:gap-3">
                <SignalCluster label="In" level={inputLevel} tone="user" live={live} />
                <div className="h-5 w-px shrink-0 bg-border/70 sm:h-6" />
                <SignalCluster label="Out" level={outputLevel} tone="coach" live={live} />
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
              {(phase === "idle" || phase === "error") && (
                <button
                  type="button"
                  onClick={() => void startFromUserGesture()}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm"
                  title="Start call"
                  aria-label="Start voice call"
                >
                  <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Start</span>
                </button>
              )}
              {phase === "live" && (
                <button
                  type="button"
                  onClick={() => void stop()}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-red-500 px-2.5 text-xs font-medium text-white transition-colors hover:bg-red-500/90 sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm"
                  title="End call"
                  aria-label="End call"
                >
                  <PhoneOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">End</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  void stop()
                  onClose()
                }}
                className="inline-flex h-8 items-center justify-center rounded-full border border-border/80 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-9 sm:px-3 sm:text-sm"
                title="Close"
                aria-label="Close voice call panel"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>

          {err && (
            <p className="mt-2.5 rounded-2xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] leading-snug text-red-600 dark:text-red-300 sm:mt-3 sm:text-xs">
              {err}
            </p>
          )}

          <p className="sr-only">Transcript appears in the task chat.</p>
        </div>
      </div>
    </>
  )
}
