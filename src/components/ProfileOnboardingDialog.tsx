import { useEffect, useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  updateUserProfile,
  type UserProfile,
  type PacePreference,
  type FeedbackStylePreference,
  type MotivationStylePreference,
} from "@/services/user"
import { Sparkles, ChevronLeft, ChevronRight, Wand2 } from "lucide-react"

type ProfileOnboardingMode = "onboarding" | "edit"

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "other", label: "Other / mix" },
]

const TONES: { value: UserProfile["preferredTone"]; label: string }[] = [
  { value: "casual", label: "Casual & friendly" },
  { value: "neutral", label: "Balanced" },
  { value: "formal", label: "Clear & formal" },
]

const STYLES: { value: UserProfile["preferredLearningStyle"]; label: string }[] = [
  { value: "video", label: "Video & walkthroughs" },
  { value: "text", label: "Reading & docs" },
  { value: "hands-on", label: "Hands-on practice" },
  { value: "mixed", label: "A bit of everything" },
]

const LEVELS: { value: UserProfile["currentSkillLevel"]; label: string }[] = [
  { value: "beginner", label: "Getting started" },
  { value: "intermediate", label: "Comfortable, still growing" },
  { value: "advanced", label: "Sharp — push me" },
]

const PACES: { value: PacePreference; label: string }[] = [
  { value: "slow", label: "Slow & thorough" },
  { value: "normal", label: "Steady" },
  { value: "fast", label: "Quick & dense" },
]

const SESSIONS: { value: UserProfile["sessionLengthPreference"]; label: string }[] = [
  { value: "short", label: "5–15 min bursts" },
  { value: "medium", label: "20–40 min" },
  { value: "long", label: "45+ min deep dives" },
]

const FEEDBACK: { value: FeedbackStylePreference; label: string }[] = [
  { value: "direct", label: "Straight to the point" },
  { value: "supportive", label: "Encouraging & gentle" },
  { value: "socratic", label: "Questions that guide me" },
]

const MOTIVATION: { value: MotivationStylePreference; label: string }[] = [
  { value: "challenge", label: "Raise the bar" },
  { value: "reassurance", label: "Steady reassurance" },
  { value: "data-driven", label: "Metrics & checkpoints" },
]

const AGE_RANGES = ["13–17", "18–24", "25–34", "35–44", "45–54", "55+", "Prefer not to say"]

function splitLines(s: string): string[] {
  return s
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function mergeInitial(initial: UserProfile | null): Partial<UserProfile> {
  if (!initial) return { nickname: "" }
  return { ...initial }
}

export interface ProfileOnboardingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  uid: string
  initialProfile: UserProfile | null
  mode: ProfileOnboardingMode
  onCompleted?: () => void
}

export function ProfileOnboardingDialog({
  open,
  onOpenChange,
  uid,
  initialProfile,
  mode,
  onCompleted,
}: ProfileOnboardingDialogProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<UserProfile>>({})
  const [accessibilityText, setAccessibilityText] = useState("")

  const totalSteps = 4

  const resetFromProps = useCallback(() => {
    setDraft(mergeInitial(initialProfile))
    setAccessibilityText(Array.isArray(initialProfile?.accessibilityNeeds) ? initialProfile.accessibilityNeeds.join("\n") : "")
    setStep(0)
  }, [initialProfile])

  useEffect(() => {
    if (open) resetFromProps()
  }, [open, resetFromProps])

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateUserProfile(uid, {
        nickname: draft.nickname?.trim() || undefined,
        preferredLanguage: draft.preferredLanguage,
        preferredTone: draft.preferredTone,
        preferredLearningStyle: draft.preferredLearningStyle,
        ageRange: draft.ageRange,
        currentSkillLevel: draft.currentSkillLevel,
        pacePreference: draft.pacePreference,
        feedbackStyle: draft.feedbackStyle,
        motivationStyle: draft.motivationStyle,
        sessionLengthPreference: draft.sessionLengthPreference,
        accessibilityNeeds: splitLines(accessibilityText),
        onboardingCompletedAt: new Date().toISOString(),
        onboardingSkipped: false,
      })
      onCompleted?.()
      onOpenChange(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    setSaving(true)
    try {
      await updateUserProfile(uid, { onboardingSkipped: true })
      onCompleted?.()
      onOpenChange(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto border-border/80 bg-card/95 backdrop-blur-sm"
        showCloseButton={mode === "edit"}
        onPointerDownOutside={(e) => mode === "onboarding" && e.preventDefault()}
        onEscapeKeyDown={(e) => mode === "onboarding" && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wand2 className="h-5 w-5 text-brand shrink-0" />
            {mode === "onboarding" ? "Tune your learning vibe" : "Edit preferences"}
          </DialogTitle>
          <DialogDescription className="text-left">
            {mode === "onboarding"
              ? "A quick, playful calibration so Duwit meets you where you are — in every chat."
              : "Update how Duwit coaches you across goals and tasks."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 justify-center py-1">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-brand" : "w-1.5 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>

        <div className="min-h-[220px] space-y-4 py-1">
          {step === 0 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand" />
                  Before we sprint, we listen.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Think of this as teaching Duwit your learning fingerprint — pace, tone, and what &quot;stuck&quot;
                  feels like for you. No wrong answers; skip anything you like.
                </p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">What should we call you?</span>
                <input
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                  value={draft.nickname ?? ""}
                  onChange={(e) => update("nickname", e.target.value)}
                  placeholder="Nickname or first name"
                />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <p className="text-sm text-muted-foreground">
                Language sets how we phrase examples; tone is the emotional temperature of explanations.
              </p>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Preferred language</span>
                <select
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                  value={draft.preferredLanguage ?? ""}
                  onChange={(e) => update("preferredLanguage", e.target.value || undefined)}
                >
                  <option value="">Select…</option>
                  {LANGUAGES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-2">
                <span className="text-sm font-medium">Tone</span>
                <div className="grid gap-2">
                  {TONES.map((o) => (
                    <button
                      key={o.value ?? "x"}
                      type="button"
                      onClick={() => update("preferredTone", o.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        draft.preferredTone === o.value
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <p className="text-sm text-muted-foreground">
                When the material clicks, how do you like it delivered — and where are you on the curve?
              </p>
              <div className="space-y-2">
                <span className="text-sm font-medium">Learning format</span>
                <div className="grid gap-2">
                  {STYLES.map((o) => (
                    <button
                      key={o.value ?? "x"}
                      type="button"
                      onClick={() => update("preferredLearningStyle", o.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        draft.preferredLearningStyle === o.value
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Where you are now</span>
                <div className="grid gap-2">
                  {LEVELS.map((o) => (
                    <button
                      key={o.value ?? "x"}
                      type="button"
                      onClick={() => update("currentSkillLevel", o.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        draft.currentSkillLevel === o.value
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <p className="text-sm text-muted-foreground">
                Rhythm matters: we&apos;ll match your cadence and how you like feedback to land.
              </p>
              <div className="space-y-2">
                <span className="text-sm font-medium">Pace</span>
                <div className="grid gap-2">
                  {PACES.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => update("pacePreference", o.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        draft.pacePreference === o.value
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Typical study session</span>
                <div className="grid gap-2">
                  {SESSIONS.map((o) => (
                    <button
                      key={o.value ?? "x"}
                      type="button"
                      onClick={() => update("sessionLengthPreference", o.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        draft.sessionLengthPreference === o.value
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Feedback style</span>
                <div className="grid gap-2">
                  {FEEDBACK.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => update("feedbackStyle", o.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        draft.feedbackStyle === o.value
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Motivation style</span>
                <div className="grid gap-2">
                  {MOTIVATION.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => update("motivationStyle", o.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        draft.motivationStyle === o.value
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <p className="text-sm text-muted-foreground">
                Last stretch — context that helps us avoid blind spots.
              </p>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Age range (optional)</span>
                <select
                  className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                  value={draft.ageRange ?? ""}
                  onChange={(e) => update("ageRange", e.target.value || undefined)}
                >
                  <option value="">Prefer not to say</option>
                  {AGE_RANGES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Accessibility or learning needs (optional)</span>
                <textarea
                  className="w-full min-h-[72px] rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 resize-y"
                  value={accessibilityText}
                  onChange={(e) => setAccessibilityText(e.target.value)}
                  placeholder="e.g. prefer shorter paragraphs, dyslexia-friendly pacing"
                />
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {mode === "onboarding" && (
              <Button type="button" variant="ghost" className="rounded-xl" onClick={handleSkip} disabled={saving}>
                Skip for now
              </Button>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl gap-1"
                onClick={() => setStep((s) => s - 1)}
                disabled={saving}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            {step < totalSteps - 1 ? (
              <Button
                type="button"
                className="rounded-xl gap-1"
                onClick={() => setStep((s) => s + 1)}
                disabled={saving}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" className="rounded-xl" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save preferences"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
