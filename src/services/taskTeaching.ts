import type { Task, ChatMessage } from "@/services/goals"
import { callAIStructured } from "@/services/ai"

// ─── State ────────────────────────────────────────────────────────────────────

export type TeachingState =
  | "loading"           // generating teaching plan
  | "teaching"          // actively teaching (phase 1-3)
  | "quiz_prompt"       // all phases done, prompting quiz consent
  | "quiz_active"       // quiz in progress (UI-driven, not chat)
  | "quiz_result_pass"  // passed (>= 70%)
  | "quiz_result_fail"  // failed (< 70%)
  | "recap"             // interactive AI recap of weak areas

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeachingPhase {
  phaseNum: number
  title: string
  objectives: string[]
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]    // exactly 4 items
  correctAnswer: number // 0-indexed
  explanation: string
  topic: string        // short topic label for weak-area tracking
}

export interface QuizAnswer {
  questionId: string
  userAnswer: number
}

export interface QuizResult {
  score: number        // 0-100
  total: number
  passed: boolean      // score >= 70
  weakAreas: string[]  // topic labels where user answered wrong
}

// ─── Markers ──────────────────────────────────────────────────────────────────

export const PHASE_COMPLETE_MARKER = "[PHASE_COMPLETE]"
export const QUIZ_READY_MARKER = "[QUIZ_READY]"

// ─── Score ────────────────────────────────────────────────────────────────────

export function scoreQuiz(answers: QuizAnswer[], questions: QuizQuestion[]): QuizResult {
  let correctCount = 0
  const weakAreas: string[] = []

  for (const answer of answers) {
    const question = questions.find((q) => q.id === answer.questionId)
    if (!question) continue
    if (answer.userAnswer === question.correctAnswer) {
      correctCount++
    } else if (question.topic && !weakAreas.includes(question.topic)) {
      weakAreas.push(question.topic)
    }
  }

  const score =
    questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0

  return { score, total: questions.length, passed: score >= 70, weakAreas }
}

// ─── AI: Teaching Plan ────────────────────────────────────────────────────────

const TEACH_PLAN_SYSTEM = `You are a curriculum designer. Given a task, design a 3-phase teaching plan.

Output ONLY a valid JSON object in exactly this shape (no markdown, no backticks):
{"phases":[
  {"phaseNum":1,"title":"short title","objectives":["objective 1","objective 2","objective 3"]},
  {"phaseNum":2,"title":"short title","objectives":["objective 1","objective 2","objective 3"]},
  {"phaseNum":3,"title":"short title","objectives":["objective 1","objective 2","objective 3"]}
]}

Rules:
- Phase 1: Foundational concepts and background context
- Phase 2: Core knowledge, key details, main mechanisms
- Phase 3: Implications, applications, critical analysis, or synthesis
- Each phase: 2-4 specific objectives describing what the learner will understand/be able to do
- Titles: 3-6 words, descriptive
- Objectives: concrete and measurable, not vague
- Calibrate depth to the task type and description`

export async function generateTeachingPlan(
  goalTitle: string,
  phaseTitle: string,
  task: Task,
  modelName?: string,
): Promise<TeachingPhase[]> {
  const prompt = `Goal: "${goalTitle}"
Phase: "${phaseTitle}"
Task: "${task.title}"
Type: ${task.type}
Description: ${task.description}

Design the 3-phase teaching plan for this task.`

  const result = await callAIStructured<{ phases: TeachingPhase[] }>({
    prompt,
    systemPrompt: TEACH_PLAN_SYSTEM,
    temperature: 0.3,
    maxOutputTokens: 800,
    modelName,
  })

  if (!Array.isArray(result?.phases) || result.phases.length === 0) {
    throw new Error("Invalid teaching plan response")
  }
  return result.phases
}

// ─── AI: Adaptive Quiz ────────────────────────────────────────────────────────

const QUIZ_SYSTEM = `You are a quiz generator. Create an adaptive quiz based on what was actually taught in the conversation.

Output ONLY a valid JSON object in exactly this shape (no markdown, no backticks):
{"questions":[
  {
    "id":"q1",
    "question":"...",
    "options":["Option A","Option B","Option C","Option D"],
    "correctAnswer":0,
    "explanation":"Brief explanation why this is correct (1-2 sentences).",
    "topic":"short topic label"
  }
]}

Rules:
- Generate exactly 4 questions
- Each question has exactly 4 options
- correctAnswer is 0-indexed (0=first option)
- Mix comprehension (recall) and application questions
- Base questions on what was actually discussed in the teaching conversation
- If weak areas are specified, weight more questions toward those areas
- Topics are short labels (3-5 words) used to identify areas for recap
- Do NOT generate trick questions; be fair and clear`

export async function generateAdaptiveQuiz(
  goalTitle: string,
  task: Task,
  chatHistory: ChatMessage[],
  weakAreas?: string[],
  modelName?: string,
): Promise<QuizQuestion[]> {
  const historyText = chatHistory
    .slice(-24)
    .map((m) => `${m.role === "user" ? "Student" : "Teacher"}: ${m.content}`)
    .join("\n\n")

  const weakAreasNote = weakAreas?.length
    ? `\nFocus extra questions on these weak areas: ${weakAreas.join(", ")}`
    : ""

  const prompt = `Goal: "${goalTitle}"
Task: "${task.title}"
Description: ${task.description}
${weakAreasNote}

Teaching conversation:
${historyText}

Generate 4 adaptive quiz questions based on what was taught above.`

  const result = await callAIStructured<{ questions: QuizQuestion[] }>({
    prompt,
    systemPrompt: QUIZ_SYSTEM,
    temperature: 0.4,
    maxOutputTokens: 1400,
    modelName,
  })

  if (!Array.isArray(result?.questions) || result.questions.length === 0) {
    throw new Error("Invalid quiz response")
  }
  return result.questions
}
