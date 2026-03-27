/**
 * Unified per-goal memory (summaries + task outcomes). Verbatim recall across
 * long chat history is intentionally not implemented here — RAG/embeddings
 * stay deferred until this layer proves insufficient.
 */
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { callAIStructured } from "@/services/ai"
import type { ChatMessage, Goal, GoalProfile, GoalState, TaskOutcome } from "@/services/goals"
import {
  buildGoalStateCompressPrompt,
  buildGoalStateQuizMergePrompt,
  buildGoalStateTaskDonePrompt,
} from "@/services/prompts"
import type { QuizResult } from "@/services/taskTeaching"
import { formatUserProfileForPrompt, type UserProfile } from "@/services/user"

const MAX_OUTCOMES = 12
const COMPRESS_USER_MESSAGE_INTERVAL = 8

export { COMPRESS_USER_MESSAGE_INTERVAL }

export async function touchGoalActivity(
  uid: string,
  goalId: string,
  phaseIndex: number,
  taskIndex: number,
): Promise<void> {
  const docRef = doc(db, "users", uid, "goals", goalId)
  await setDoc(
    docRef,
    {
      lastActivityAt: new Date().toISOString(),
      lastTouchedPhaseIndex: phaseIndex,
      lastTouchedTaskIndex: taskIndex,
    },
    { merge: true },
  )
}

function mergeOutcomes(existing: TaskOutcome[] | undefined, next: TaskOutcome): TaskOutcome[] {
  const list = [...(existing ?? [])]
  const idx = list.findIndex(
    (o) => o.phaseIndex === next.phaseIndex && o.taskIndex === next.taskIndex,
  )
  if (idx >= 0) list[idx] = next
  else list.push(next)
  return list.slice(-MAX_OUTCOMES)
}

async function loadGoal(uid: string, goalId: string): Promise<Goal | null> {
  const ref = doc(db, "users", uid, "goals", goalId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, uid, ...snap.data() } as Goal
}

async function persistGoalState(uid: string, goalId: string, state: GoalState): Promise<void> {
  const ref = doc(db, "users", uid, "goals", goalId)
  await setDoc(ref, { goalState: state }, { merge: true })
}

interface QuizMergeAI {
  workingSummary: string
  taskOutcomeSummary: string
}

const GOAL_STATE_JSON_SYSTEM = `You output ONLY valid JSON. No markdown, no backticks, no commentary.
Shape: {"workingSummary":"string","taskOutcomeSummary":"string"}
Rules:
- workingSummary: 2-4 short sentences, factual, for a coach. Merge new info with the prior narrative; do not repeat the whole plan.
- taskOutcomeSummary: ONE concise line about this task + quiz outcome.`

const COMPRESS_JSON_SYSTEM = `You output ONLY valid JSON. No markdown, no backticks.
Shape: {"workingSummary":"string"}
Rules:
- Produce an updated workingSummary (2-4 sentences) that merges the previous summary with what happened in the recent chat excerpt.
- Favor concrete topics covered and remaining gaps over generic encouragement.`

const TASK_DONE_JSON_SYSTEM = `You output ONLY valid JSON. No markdown, no backticks.
Shape: {"workingSummary":"string","taskOutcomeSummary":"string"}
Rules:
- workingSummary: 2-4 sentences, update the running narrative.
- taskOutcomeSummary: one line — user marked this task complete (may or may not have used the in-app quiz).`

/**
 * After quiz pass/fail: refresh unified summary + per-task outcome.
 */
export async function recordQuizInGoalState(
  uid: string,
  goalId: string,
  goalTitle: string,
  profile: GoalProfile | undefined,
  phaseIndex: number,
  taskIndex: number,
  taskTitle: string,
  result: QuizResult,
  modelName?: string,
  userProfile?: UserProfile | null,
): Promise<void> {
  const goal = await loadGoal(uid, goalId)
  if (!goal) return

  const prev = goal.goalState
  const userProfileBlock = formatUserProfileForPrompt(userProfile)
  const prompt = buildGoalStateQuizMergePrompt({
    goalTitle,
    profile,
    userProfileBlock: userProfileBlock || undefined,
    priorSummary: prev?.workingSummary ?? "",
    priorOutcomes: prev?.taskOutcomes ?? [],
    phaseIndex,
    taskIndex,
    taskTitle,
    quizPassed: result.passed,
    quizScore: result.score,
    weakAreas: result.weakAreas,
  })

  let merge: QuizMergeAI
  try {
    merge = await callAIStructured<QuizMergeAI>({
      prompt,
      systemPrompt: GOAL_STATE_JSON_SYSTEM,
      temperature: 0.2,
      maxOutputTokens: 800,
      modelName,
    })
  } catch {
    merge = {
      workingSummary:
        prev?.workingSummary ||
        `Working on "${goalTitle}". Latest: "${taskTitle}" — quiz score ${result.score}%.`,
      taskOutcomeSummary: result.passed
        ? `Passed quiz on "${taskTitle}" (${result.score}%).`
        : `Quiz on "${taskTitle}" needs work (${result.score}%); topics: ${result.weakAreas.join(", ") || "unclear"}.`,
    }
  }

  const outcome: TaskOutcome = {
    phaseIndex,
    taskIndex,
    taskTitle,
    summary: merge.taskOutcomeSummary,
    quizPassed: result.passed,
    quizScore: result.score,
    weakTopics: result.weakAreas.length ? result.weakAreas : undefined,
    updatedAt: new Date().toISOString(),
  }

  const next: GoalState = {
    workingSummary: clampSummary(merge.workingSummary),
    taskOutcomes: mergeOutcomes(prev?.taskOutcomes, outcome),
    updatedAt: new Date().toISOString(),
  }

  await persistGoalState(uid, goalId, next)
  await touchGoalActivity(uid, goalId, phaseIndex, taskIndex)
}

/**
 * When user marks a task complete (e.g. checkbox or Mark Complete) without a fresh quiz in this call.
 */
export async function recordTaskMarkedCompleteInGoalState(
  uid: string,
  goalId: string,
  goalTitle: string,
  profile: GoalProfile | undefined,
  phaseIndex: number,
  taskIndex: number,
  taskTitle: string,
  modelName?: string,
  userProfile?: UserProfile | null,
): Promise<void> {
  const goal = await loadGoal(uid, goalId)
  if (!goal) return

  const prev = goal.goalState
  const userProfileBlock = formatUserProfileForPrompt(userProfile)
  const recentSame = prev?.taskOutcomes?.find(
    (o) => o.phaseIndex === phaseIndex && o.taskIndex === taskIndex,
  )
  if (
    recentSame?.quizScore !== undefined &&
    Date.now() - new Date(recentSame.updatedAt).getTime() < 5 * 60 * 1000
  ) {
    await touchGoalActivity(uid, goalId, phaseIndex, taskIndex)
    return
  }
  const prompt = buildGoalStateTaskDonePrompt({
    goalTitle,
    profile,
    userProfileBlock: userProfileBlock || undefined,
    priorSummary: prev?.workingSummary ?? "",
    phaseIndex,
    taskIndex,
    taskTitle,
  })

  let merge: QuizMergeAI
  try {
    merge = await callAIStructured<QuizMergeAI>({
      prompt,
      systemPrompt: TASK_DONE_JSON_SYSTEM,
      temperature: 0.2,
      maxOutputTokens: 600,
      modelName,
    })
  } catch {
    merge = {
      workingSummary: prev?.workingSummary || `Progress on "${goalTitle}".`,
      taskOutcomeSummary: `Completed task: "${taskTitle}".`,
    }
  }

  const outcome: TaskOutcome = {
    phaseIndex,
    taskIndex,
    taskTitle,
    summary: merge.taskOutcomeSummary,
    updatedAt: new Date().toISOString(),
  }

  const next: GoalState = {
    workingSummary: clampSummary(merge.workingSummary),
    taskOutcomes: mergeOutcomes(prev?.taskOutcomes, outcome),
    updatedAt: new Date().toISOString(),
  }

  await persistGoalState(uid, goalId, next)
}

/**
 * Periodically compress recent task chat into the rolling workingSummary.
 */
export async function maybeCompressTaskChatIntoGoalState(
  uid: string,
  goalId: string,
  goalTitle: string,
  profile: GoalProfile | undefined,
  phaseIndex: number,
  taskIndex: number,
  taskTitle: string,
  messages: ChatMessage[],
  modelName?: string,
  userProfile?: UserProfile | null,
): Promise<boolean> {
  const userTurns = messages.filter((m) => m.role === "user").length
  if (userTurns === 0 || userTurns % COMPRESS_USER_MESSAGE_INTERVAL !== 0) return false

  const goal = await loadGoal(uid, goalId)
  if (!goal) return false

  const prev = goal.goalState
  const userProfileBlock = formatUserProfileForPrompt(userProfile)
  const recent = messages.slice(-16)
  const excerpt = recent
    .map((m) => `${m.role === "user" ? "Student" : "Teacher"}: ${m.content}`)
    .join("\n\n")
    .slice(-3500)

  const prompt = buildGoalStateCompressPrompt({
    goalTitle,
    profile,
    userProfileBlock: userProfileBlock || undefined,
    taskTitle,
    phaseIndex,
    taskIndex,
    priorSummary: prev?.workingSummary ?? "",
    chatExcerpt: excerpt,
  })

  try {
    const { workingSummary } = await callAIStructured<{ workingSummary: string }>({
      prompt,
      systemPrompt: COMPRESS_JSON_SYSTEM,
      temperature: 0.25,
      maxOutputTokens: 600,
      modelName,
    })

    const next: GoalState = {
      workingSummary: clampSummary(workingSummary),
      taskOutcomes: prev?.taskOutcomes ?? [],
      updatedAt: new Date().toISOString(),
    }
    await persistGoalState(uid, goalId, next)
    return true
  } catch {
    /* non-fatal */
  }
  return false
}

function clampSummary(s: string, max = 1200): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}
