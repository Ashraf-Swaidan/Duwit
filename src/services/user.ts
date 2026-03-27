import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { GoalProfile } from "@/services/goals"

/** Bump when adding new preference fields so migrations can run later if needed */
export const USER_PROFILE_VERSION = 1

export type PacePreference = "slow" | "normal" | "fast"
export type FeedbackStylePreference = "direct" | "supportive" | "socratic"
export type MotivationStylePreference = "challenge" | "reassurance" | "data-driven"

export interface UserProfile {
  nickname?: string
  preferredLanguage?: string
  preferredTone?: "casual" | "neutral" | "formal"
  ageRange?: string
  preferredLearningStyle?: "video" | "text" | "hands-on" | "mixed"
  /** High-level learning targets (e.g. "career change", "exam prep") */
  learningGoals?: string[]
  currentSkillLevel?: "beginner" | "intermediate" | "advanced"
  pacePreference?: PacePreference
  feedbackStyle?: FeedbackStylePreference
  motivationStyle?: MotivationStylePreference
  sessionLengthPreference?: "short" | "medium" | "long"
  focusAreas?: string[]
  accessibilityNeeds?: string[]
  /** Set when user finishes onboarding wizard (Save) */
  onboardingCompletedAt?: string
  /** If true, never auto-show onboarding again */
  onboardingSkipped?: boolean
  profileVersion?: number
}

interface UserDoc {
  email?: string
  displayName?: string
  createdAt?: string
  profile?: UserProfile
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, "users", uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data() as UserDoc
  return data.profile ?? null
}

/**
 * True when we should nudge the user through the profile wizard (until they save or skip).
 */
export function shouldShowProfileOnboarding(profile: UserProfile | null): boolean {
  if (profile?.onboardingSkipped) return false
  if (profile?.onboardingCompletedAt) return false
  if (!profile) return true

  const hasOneField =
    Boolean(profile.nickname?.trim()) ||
    Boolean(profile.preferredLanguage?.trim()) ||
    Boolean(profile.preferredTone) ||
    Boolean(profile.ageRange?.trim()) ||
    Boolean(profile.preferredLearningStyle) ||
    Boolean(profile.currentSkillLevel) ||
    Boolean(profile.pacePreference) ||
    Boolean(profile.feedbackStyle) ||
    Boolean(profile.motivationStyle) ||
    Boolean(profile.sessionLengthPreference) ||
    Boolean(profile.learningGoals?.length) ||
    Boolean(profile.focusAreas?.length) ||
    Boolean(profile.accessibilityNeeds?.length)

  return !hasOneField
}

function cleanArray(arr: string[] | undefined): string[] | undefined {
  if (!arr?.length) return undefined
  const next = arr.map((s) => s.trim()).filter(Boolean)
  return next.length ? next : undefined
}

function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as T
}

/**
 * Merge partial updates with existing Firestore profile.
 */
export async function updateUserProfile(uid: string, partial: Partial<UserProfile>): Promise<void> {
  const ref = doc(db, "users", uid)
  const snap = await getDoc(ref)
  const prev = ((snap.data() as UserDoc | undefined)?.profile ?? {}) as UserProfile
  const merged: UserProfile = removeUndefinedFields({
    ...prev,
    ...partial,
    learningGoals: partial.learningGoals !== undefined ? cleanArray(partial.learningGoals) : prev.learningGoals,
    focusAreas: partial.focusAreas !== undefined ? cleanArray(partial.focusAreas) : prev.focusAreas,
    accessibilityNeeds:
      partial.accessibilityNeeds !== undefined ? cleanArray(partial.accessibilityNeeds) : prev.accessibilityNeeds,
    profileVersion: USER_PROFILE_VERSION,
  })
  await setDoc(ref, { profile: merged }, { merge: true })
}

function pushLine(lines: string[], label: string, value: string | undefined) {
  const v = value?.trim()
  if (v) lines.push(`- ${label}: ${v}`)
}

/**
 * Compact block for system prompts — used across Home, Goal chat, Task chat, etc.
 */
export function formatUserProfileForPrompt(profile: UserProfile | null | undefined): string {
  if (!profile) return ""
  const lines: string[] = []
  pushLine(lines, "What to call them", profile.nickname)
  pushLine(lines, "Preferred language", profile.preferredLanguage)
  pushLine(lines, "Communication tone", profile.preferredTone)
  pushLine(lines, "Age range", profile.ageRange)
  pushLine(lines, "Preferred learning format", profile.preferredLearningStyle)
  if (profile.learningGoals?.length) {
    lines.push(`- Learning goals: ${profile.learningGoals.join("; ")}`)
  }
  pushLine(lines, "Self-assessed skill level", profile.currentSkillLevel)
  pushLine(lines, "Preferred pace", profile.pacePreference)
  pushLine(lines, "Feedback style", profile.feedbackStyle)
  pushLine(lines, "Motivation style", profile.motivationStyle)
  pushLine(lines, "Typical session length", profile.sessionLengthPreference)
  if (profile.focusAreas?.length) {
    lines.push(`- Focus areas: ${profile.focusAreas.join("; ")}`)
  }
  if (profile.accessibilityNeeds?.length) {
    lines.push(`- Accessibility / learning needs: ${profile.accessibilityNeeds.join("; ")}`)
  }
  if (lines.length === 0) return ""
  return `Learner profile (honor consistently — adapt explanations, pacing, and tone):\n${lines.join("\n")}`
}

/** Compact per-goal lines for curriculum / teaching-plan prompts. */
export function formatGoalProfileForTeaching(profile: GoalProfile | null | undefined): string {
  if (!profile) return ""
  const parts: string[] = []
  parts.push(`- Experience level: ${profile.experienceLevel}`)
  if (profile.successDefinition?.trim()) parts.push(`- What success looks like: ${profile.successDefinition.trim()}`)
  if (profile.motivation?.trim()) parts.push(`- Motivation: ${profile.motivation.trim()}`)
  if (profile.notes?.trim()) parts.push(`- Notes: ${profile.notes.trim()}`)
  if (parts.length === 0) return ""
  return `Goal-specific learner context:\n${parts.join("\n")}`
}

/** Combined global + per-goal context for micro-curriculum generation (user message append). */
export function buildTeachingLearnerContext(
  userProfile: UserProfile | null | undefined,
  goalProfile: GoalProfile | undefined,
): string {
  const u = formatUserProfileForPrompt(userProfile)
  const g = formatGoalProfileForTeaching(goalProfile)
  if (!u && !g) return ""
  return [u, g].filter(Boolean).join("\n\n")
}
