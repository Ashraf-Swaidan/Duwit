import { db } from "@/lib/firebase"
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore"
import type { QueryClient } from "@tanstack/react-query"
import type { Goal } from "@/services/goals"
import type { HomeConciergeGoalRow } from "@/services/prompts"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserContext {
  /** The goal the user interacted with most recently */
  lastGoalId?: string
  lastGoalTitle?: string
  /** ISO timestamp of the last task completion or goal interaction */
  lastActivityAt?: string
  /** The progress snapshot at the time the greeting was generated */
  snapshotProgress?: Record<string, number>
}

export interface CachedGreeting {
  /** The greeting message as rendered to the user */
  message: string
  /** What the AI detected as the "suggested" goal to resume */
  suggestedGoalId?: string
  suggestedGoalTitle?: string
  /** ISO timestamp this greeting was generated */
  generatedAt: string
  /** Snapshot that was valid when this greeting was made */
  contextHash: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a lightweight "hash" that represents the user's current context state.
 * If anything changes (new goal, completed task, etc.), the hash changes,
 * which tells us a fresh AI greeting is needed.
 */
export function buildContextHash(goals: Goal[]): string {
  const parts = goals.map(
    (g) =>
      `${g.id}:${g.progress ?? 0}:${g.status}:${g.lastActivityAt ?? ""}:${g.goalState?.updatedAt ?? ""}`,
  )
  return parts.sort().join("|")
}

/**
 * Derive a UserContext object from a list of goals. 
 * Picks the most recently active goal as the "last goal".
 */
export function deriveUserContext(goals: Goal[]): UserContext {
  const activeGoals = goals.filter((g) => g.status === "active")

  // Find the goal with the most recent activity (most tasks done, most progress)
  const sorted = [...activeGoals].sort((a, b) => {
    const aTime = getLastActivityTime(a)
    const bTime = getLastActivityTime(b)
    return bTime - aTime
  })

  const mostRecent = sorted[0]

  return {
    lastGoalId: mostRecent?.id,
    lastGoalTitle: mostRecent?.title,
    lastActivityAt: mostRecent ? new Date(getLastActivityTime(mostRecent)).toISOString() : undefined,
  }
}

function getLastActivityTime(goal: Goal): number {
  let latest = new Date(goal.createdAt).getTime()

  if (goal.lastActivityAt) {
    const t = new Date(goal.lastActivityAt).getTime()
    if (!Number.isNaN(t) && t > latest) latest = t
  }

  for (const phase of goal.phases ?? []) {
    for (const task of phase.tasks ?? []) {
      if (task.completedAt) {
        const t = new Date(task.completedAt).getTime()
        if (t > latest) latest = t
      }
    }
  }

  return latest
}

// ─── Firestore Persistence ────────────────────────────────────────────────────

export async function loadCachedGreeting(uid: string): Promise<CachedGreeting | null> {
  const ref = doc(db, "users", uid, "meta", "homeGreeting")
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as CachedGreeting
}

export async function saveCachedGreeting(uid: string, greeting: CachedGreeting): Promise<void> {
  const ref = doc(db, "users", uid, "meta", "homeGreeting")
  await setDoc(ref, greeting)
}

/** Clears persisted home greeting so the next visit regens against current goals (e.g. after delete). */
export async function clearCachedGreeting(uid: string): Promise<void> {
  const ref = doc(db, "users", uid, "meta", "homeGreeting")
  await deleteDoc(ref)
}

/** Call after goals are added/removed so Home refetches goals and drops stale concierge cache. */
export async function notifyHomeGoalsChanged(uid: string, queryClient: QueryClient): Promise<void> {
  await clearCachedGreeting(uid).catch(() => {})
  await queryClient.invalidateQueries({ queryKey: ["goals"] })
}

// ─── Core Logic ───────────────────────────────────────────────────────────────

/**
 * Determines whether we need a fresh AI greeting or can return the cached one.
 * Returns null if AI is needed, or the cached message if still valid.
 */
export function getCachedGreetingIfValid(
  cached: CachedGreeting | null,
  currentHash: string,
): CachedGreeting | null {
  if (!cached) return null
  if (cached.contextHash !== currentHash) return null

  // Also expire the cache after 12 hours, so the greeting feels fresh each day
  const generated = new Date(cached.generatedAt).getTime()
  const twelveHoursMs = 12 * 60 * 60 * 1000
  if (Date.now() - generated > twelveHoursMs) return null

  return cached
}

/**
 * Build the quick template-based greeting we display INSTANTLY while we wait
 * for the AI to respond (or if AI is not needed).
 */
export function buildInstantGreeting(firstName: string, goals: Goal[]): string {
  const hour = new Date().getHours()
  const timeGreeting =
    hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  if (goals.length === 0) {
    return `${timeGreeting}, ${firstName}! Ready to set your first goal?`
  }

  const ctx = deriveUserContext(goals)
  if (ctx.lastGoalTitle) {
    return `${timeGreeting}, ${firstName}! Want to continue with **${ctx.lastGoalTitle}**?`
  }

  return `${timeGreeting}, ${firstName}! You have ${goals.length} active ${goals.length === 1 ? "goal" : "goals"}.`
}

/**
 * Given the user's goals, build suggestion chips that appear below the chat.
 * These let the user jump to a goal with one tap without having to type.
 */
export interface GoalSuggestion {
  goalId: string
  label: string
  progress: number
}

export function buildGoalSuggestions(goals: Goal[]): GoalSuggestion[] {
  const active = goals
    .filter((g) => g.status === "active" && (g.progress ?? 0) < 100)
    .sort((a, b) => getLastActivityTime(b) - getLastActivityTime(a))
    .slice(0, 3)

  return active.map((g) => ({
    goalId: g.id!,
    label: `Continue: ${g.title}`,
    progress: g.progress ?? 0,
  }))
}

function formatLastTouchedTaskLabel(g: Goal): string | undefined {
  if (g.lastTouchedPhaseIndex == null || g.lastTouchedTaskIndex == null) return undefined
  const phase = g.phases?.[g.lastTouchedPhaseIndex]
  const task = phase?.tasks?.[g.lastTouchedTaskIndex]
  if (!phase || !task) return undefined
  return `${phase.title} › ${task.title}`
}

/** Rich rows for home AI: activity + coach memory snippets */
export function goalsToConciergeRows(goals: Goal[]): HomeConciergeGoalRow[] {
  return goals.map((g) => {
    const sum = g.goalState?.workingSummary ?? ""
    const snippet =
      sum.length > 0
        ? sum.slice(0, 240) + (sum.length > 240 ? "…" : "")
        : undefined
    return {
      id: g.id!,
      title: g.title,
      progress: g.progress ?? 0,
      lastActivityAt: g.lastActivityAt,
      lastTouchedTaskLabel: formatLastTouchedTaskLabel(g),
      workingSummarySnippet: snippet,
    }
  })
}
