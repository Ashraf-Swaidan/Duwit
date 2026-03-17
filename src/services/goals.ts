import { db } from "@/lib/firebase"
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore"

export interface Task {
  title: string
  description: string
  type: "learn" | "build" | "practice" | "project" | "review"
  estimatedDays: number
  completed?: boolean
  completedAt?: string
}

export interface Phase {
  title: string
  description: string
  tasks: Task[]
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
): Promise<void> {
  const chatRef = doc(db, "users", uid, "goals", goalId, "taskChats", `${phaseIndex}_${taskIndex}`)
  await setDoc(chatRef, { messages, updatedAt: new Date().toISOString() })
}

export async function loadTaskChat(
  uid: string,
  goalId: string,
  phaseIndex: number,
  taskIndex: number,
): Promise<ChatMessage[]> {
  const chatRef = doc(db, "users", uid, "goals", goalId, "taskChats", `${phaseIndex}_${taskIndex}`)
  const snap = await getDoc(chatRef)
  if (!snap.exists()) return []
  return (snap.data().messages ?? []) as ChatMessage[]
}

export async function updateTaskCompletion(
  uid: string,
  goalId: string,
  phaseIndex: number,
  taskIndex: number,
  completed: boolean,
): Promise<void> {
  const docRef = doc(db, "users", uid, "goals", goalId)
  const snap = await getDoc(docRef)

  if (!snap.exists()) throw new Error("Goal not found")

  const data = snap.data() as Goal
  if (data.phases[phaseIndex] && data.phases[phaseIndex].tasks[taskIndex]) {
    data.phases[phaseIndex].tasks[taskIndex].completed = completed
    if (completed) {
      data.phases[phaseIndex].tasks[taskIndex].completedAt = new Date().toISOString()
    }

    const totalTasks = data.phases.reduce((acc, p) => acc + p.tasks.length, 0)
    const completedTasks = data.phases.reduce(
      (acc, p) => acc + p.tasks.filter((t) => t.completed).length,
      0,
    )
    const newProgress = Math.round((completedTasks / totalTasks) * 100)

    await setDoc(docRef, { phases: data.phases, progress: newProgress }, { merge: true })
  }
}
