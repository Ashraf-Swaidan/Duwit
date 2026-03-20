import { db } from "@/lib/firebase"
import type { LessonStep } from "@/types/curriculum"
import type { TaskTeachingPersistV1 } from "@/services/taskTeaching"
import { parseTaskTeachingPersist } from "@/services/taskTeaching"

export type { LessonStep } from "@/types/curriculum"
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore"

export interface Task {
  title: string
  description: string
  type: "learn" | "build" | "practice" | "project" | "review"
  estimatedDays: number
  completed?: boolean
  completedAt?: string
  /** Stored micro-curriculum for this checklist task (3 lesson steps). */
  lessonSteps?: LessonStep[]
}

export interface Phase {
  title: string
  description: string
  tasks: Task[]
}

export interface GoalProfile {
  // High-level sense of where they are starting from
  experienceLevel: "beginner" | "intermediate" | "advanced"
  // Free-form description like "30 minutes", "1–2 hours", etc.
  timePerDay: string
  // Why they care about this goal
  motivation: string
  // What success looks like in their own words
  successDefinition: string
  // Optional extra notes the AI thinks will help (constraints, preferences, prior knowledge)
  notes?: string
}

/** One line of durable progress for cross-task AI context */
export interface TaskOutcome {
  phaseIndex: number
  taskIndex: number
  taskTitle: string
  summary: string
  quizPassed?: boolean
  quizScore?: number
  weakTopics?: string[]
  updatedAt: string
}

/** Rolling narrative + outcomes — injected into task/home prompts (not raw chat logs) */
export interface GoalState {
  workingSummary: string
  taskOutcomes: TaskOutcome[]
  updatedAt: string
}

export interface Goal {
  id?: string
  uid?: string
  title: string
  description: string
  phases: Phase[]
  status: "active" | "completed" | "archived"
  createdAt: string
  completedAt?: string
  progress?: number
  // Per-goal \"memory\" distilled from the discovery chat
  profile?: GoalProfile
  /** Unified coach memory across tasks */
  goalState?: GoalState
  /** Last time user opened a task chat or completed work (ISO) */
  lastActivityAt?: string
  lastTouchedPhaseIndex?: number
  lastTouchedTaskIndex?: number
  /** Set when every task has validated `lessonSteps` (plan v1 curriculum). */
  curriculumSchemaVersion?: 1
}

export async function createGoal(uid: string, goal: Goal): Promise<string> {
  const goalsRef = collection(db, "users", uid, "goals")
  const docRef = doc(goalsRef)

  const goalData = {
    ...goal,
    createdAt: new Date().toISOString(),
    status: "active" as const,
    progress: 0,
  }

  await setDoc(docRef, goalData)
  return docRef.id
}

export async function getGoal(uid: string, goalId: string): Promise<Goal | null> {
  const docRef = doc(db, "users", uid, "goals", goalId)
  const snap = await getDoc(docRef)

  if (!snap.exists()) return null

  return {
    id: snap.id,
    uid,
    ...snap.data(),
  } as Goal
}

export async function getUserGoals(uid: string): Promise<Goal[]> {
  const goalsRef = collection(db, "users", uid, "goals")
  const q = query(goalsRef, where("status", "!=", "archived"))
  const snap = await getDocs(q)

  return snap.docs.map((doc) => ({
    id: doc.id,
    uid,
    ...doc.data(),
  })) as Goal[]
}

/** True when the goal is marked completed or every task in the plan is done (covers older docs). */
export function isGoalCompleted(goal: Pick<Goal, "status" | "phases">): boolean {
  if (goal.status === "completed") return true
  const phases = goal.phases ?? []
  const total = phases.reduce((acc, p) => acc + p.tasks.length, 0)
  if (total === 0) return false
  const done = phases.reduce((acc, p) => acc + p.tasks.filter((t) => t.completed).length, 0)
  return done === total
}

export async function updateGoalProgress(uid: string, goalId: string, progress: number): Promise<void> {
  const docRef = doc(db, "users", uid, "goals", goalId)
  await setDoc(docRef, { progress }, { merge: true })
}

export async function updateGoalStatus(
  uid: string,
  goalId: string,
  status: "active" | "completed" | "archived",
): Promise<void> {
  const docRef = doc(db, "users", uid, "goals", goalId)
  const updateData: Record<string, unknown> = { status }

  if (status === "completed") {
    updateData.completedAt = new Date().toISOString()
  }

  await setDoc(docRef, updateData, { merge: true })
}

/** Deletes all `taskChats` subdocuments then the goal (chunked batches ≤ 500 ops). */
export async function deleteGoal(uid: string, goalId: string): Promise<void> {
  const goalRef = doc(db, "users", uid, "goals", goalId)
  const chatsRef = collection(db, "users", uid, "goals", goalId, "taskChats")
  const chatsSnap = await getDocs(chatsRef)
  const chatDocs = chatsSnap.docs

  const chunkSize = 400
  for (let i = 0; i < chatDocs.length; i += chunkSize) {
    const batch = writeBatch(db)
    for (const d of chatDocs.slice(i, i + chunkSize)) {
      batch.delete(d.ref)
    }
    await batch.commit()
  }

  await deleteDoc(goalRef)
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export async function saveTaskChat(
  uid: string,
  goalId: string,
  phaseIndex: number,
  taskIndex: number,
  messages: ChatMessage[],
  teachingPersist?: TaskTeachingPersistV1 | null,
): Promise<void> {
  const chatRef = doc(db, "users", uid, "goals", goalId, "taskChats", `${phaseIndex}_${taskIndex}`)
  const payload: Record<string, unknown> = {
    messages,
    updatedAt: new Date().toISOString(),
  }
  if (teachingPersist !== undefined) {
    if (teachingPersist === null) {
      payload.teachingPersist = null
    } else {
      // Firestore rejects nested `undefined`; JSON round-trip drops those keys.
      payload.teachingPersist = JSON.parse(JSON.stringify(teachingPersist)) as TaskTeachingPersistV1
    }
  }
  await setDoc(chatRef, payload, { merge: true })
}

export interface TaskChatDocument {
  messages: ChatMessage[]
  teachingPersist: TaskTeachingPersistV1 | null
}

export async function loadTaskChat(
  uid: string,
  goalId: string,
  phaseIndex: number,
  taskIndex: number,
): Promise<ChatMessage[]> {
  const data = await loadTaskChatDocument(uid, goalId, phaseIndex, taskIndex)
  return data.messages
}

export async function loadTaskChatDocument(
  uid: string,
  goalId: string,
  phaseIndex: number,
  taskIndex: number,
): Promise<TaskChatDocument> {
  const chatRef = doc(db, "users", uid, "goals", goalId, "taskChats", `${phaseIndex}_${taskIndex}`)
  const snap = await getDoc(chatRef)
  if (!snap.exists()) return { messages: [], teachingPersist: null }
  const data = snap.data()
  const messages = (data.messages ?? []) as ChatMessage[]
  const teachingPersist = parseTaskTeachingPersist(data.teachingPersist)
  return { messages, teachingPersist }
}

export async function updateTaskCompletion(
  uid: string,
  goalId: string,
  phaseIndex: number,
  taskIndex: number,
  completed: boolean,
): Promise<{ goalJustCompleted: boolean }> {
  const docRef = doc(db, "users", uid, "goals", goalId)
  const snap = await getDoc(docRef)

  if (!snap.exists()) throw new Error("Goal not found")

  const data = snap.data() as Goal
  if (!data.phases?.[phaseIndex]?.tasks?.[taskIndex]) {
    return { goalJustCompleted: false }
  }

  data.phases[phaseIndex].tasks[taskIndex].completed = completed
  if (completed) {
    data.phases[phaseIndex].tasks[taskIndex].completedAt = new Date().toISOString()
  } else {
    delete data.phases[phaseIndex].tasks[taskIndex].completedAt
  }

  const totalTasks = data.phases.reduce((acc, p) => acc + p.tasks.length, 0)
  const completedTasks = data.phases.reduce(
    (acc, p) => acc + p.tasks.filter((t) => t.completed).length,
    0,
  )
  const newProgress =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const allDone = totalTasks > 0 && completedTasks === totalTasks
  const goalJustCompleted = completed && allDone

  const payload: Record<string, unknown> = {
    phases: data.phases,
    progress: newProgress,
  }

  if (allDone) {
    payload.status = "completed" as const
    payload.completedAt = new Date().toISOString()
  } else {
    payload.status = "active" as const
    payload.completedAt = deleteField()
  }

  await setDoc(docRef, payload, { merge: true })
  return { goalJustCompleted }
}
