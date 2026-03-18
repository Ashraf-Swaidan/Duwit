import { useState, useEffect, useRef } from "react"
import type { Task, ChatMessage } from "@/services/goals"
import {
  type TeachingState,
  type TeachingPhase,
  type QuizQuestion,
  type QuizAnswer,
  type QuizResult,
  generateTeachingPlan,
  generateAdaptiveQuiz,
  scoreQuiz,
} from "@/services/taskTeaching"
import type { TeachingContext } from "@/services/prompts"

interface UseTaskTeachingOptions {
  task: Task
  goalTitle: string
  phaseTitle: string
  messages: ChatMessage[]
  selectedModel?: string
  /**
   * Set to true once history loading is complete AND there were no saved
   * messages. The hook watches this and runs plan generation on the first
   * true transition.
   */
  isNewChat: boolean
}

export interface UseTaskTeachingReturn {
  /** null = unstructured mode (returning chat) */
  teachingState: TeachingState | null
  phases: TeachingPhase[]
  currentPhase: TeachingPhase | null
  currentPhaseIndex: number
  totalPhases: number
  /** Show the "Ready to move on?" card */
  showAdvanceCard: boolean
  quizQuestions: QuizQuestion[]
  currentQuizIndex: number
  quizAnswers: QuizAnswer[]
  quizResult: QuizResult | null
  generatingQuiz: boolean
  planError: boolean
  /** Context object to pass to generateTaskGuideSystemPrompt */
  teachingContext: TeachingContext | undefined
  // Actions
  handleAIMarkers: (rawResponse: string) => string
  advancePhase: () => void
  stayInPhase: () => void
  startQuiz: () => Promise<void>
  answerQuizQuestion: (answerIndex: number) => void
  retakeQuiz: () => Promise<void>
  startRecap: () => void
}

export function useTaskTeaching({
  task,
  goalTitle,
  phaseTitle,
  messages,
  selectedModel,
  isNewChat,
}: UseTaskTeachingOptions): UseTaskTeachingReturn {
  // Start as null; will be set to "loading" when isNewChat first triggers
  const [teachingState, setTeachingState] = useState<TeachingState | null>(null)
  const [phases, setPhases] = useState<TeachingPhase[]>([])
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0)
  const [showAdvanceCard, setShowAdvanceCard] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([])
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  const [generatingQuiz, setGeneratingQuiz] = useState(false)
  const [planError, setPlanError] = useState(false)
  const initializedRef = useRef(false)

  // Generate teaching plan once, triggered when isNewChat first becomes true
  useEffect(() => {
    if (!isNewChat || initializedRef.current) return
    initializedRef.current = true
    setTeachingState("loading")

    generateTeachingPlan(goalTitle, phaseTitle, task, selectedModel)
      .then((plan) => {
        setPhases(plan)
        setTeachingState("teaching")
      })
      .catch(() => {
        setPlanError(true)
        setTeachingState(null) // fall back to unstructured mode
      })
  }, [isNewChat]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentPhase = phases[currentPhaseIndex] ?? null

  // Build the context object that TaskChat passes to the system prompt generator
  const teachingContext: TeachingContext | undefined = (() => {
    if (!teachingState || teachingState === "loading") return undefined
    if (teachingState === "quiz_active" || teachingState === "quiz_result_pass" || teachingState === "quiz_result_fail") return undefined

    if (teachingState === "teaching" && currentPhase) {
      return {
        state: "teaching",
        currentPhase,
        totalPhases: phases.length,
      }
    }
    if (teachingState === "quiz_prompt") {
      return { state: "quiz_prompt" }
    }
    if (teachingState === "recap" && quizResult?.weakAreas.length) {
      return { state: "recap", weakAreas: quizResult.weakAreas }
    }
    return undefined
  })()

  /**
   * Parse AI response for teaching markers, strip them from the visible text,
   * and trigger side-effects (phase advance card, quiz prompt, etc.)
   * Returns the cleaned response text.
   */
  function handleAIMarkers(rawResponse: string): string {
    let clean = rawResponse

    if (rawResponse.includes("[QUIZ_READY]")) {
      clean = rawResponse.replaceAll("[QUIZ_READY]", "").trim()
      setShowAdvanceCard(false)
      setTeachingState("quiz_prompt")
      return clean
    }

    if (rawResponse.includes("[PHASE_COMPLETE]")) {
      clean = rawResponse.replaceAll("[PHASE_COMPLETE]", "").trim()
      if (currentPhaseIndex >= phases.length - 1) {
        // shouldn't normally happen (last phase should emit QUIZ_READY) but handle gracefully
        setTeachingState("quiz_prompt")
      } else {
        setShowAdvanceCard(true)
      }
      return clean
    }

    return clean
  }

  function advancePhase() {
    setShowAdvanceCard(false)
    setCurrentPhaseIndex((i) => i + 1)
  }

  function stayInPhase() {
    setShowAdvanceCard(false)
  }

  async function startQuiz() {
    if (generatingQuiz) return
    setGeneratingQuiz(true)
    try {
      const questions = await generateAdaptiveQuiz(goalTitle, task, messages, undefined, selectedModel)
      setQuizQuestions(questions)
      setCurrentQuizIndex(0)
      setQuizAnswers([])
      setQuizResult(null)
      setTeachingState("quiz_active")
    } catch {
      // quiz generation failed — just leave in quiz_prompt state, user can retry
    } finally {
      setGeneratingQuiz(false)
    }
  }

  function answerQuizQuestion(answerIndex: number) {
    const question = quizQuestions[currentQuizIndex]
    if (!question) return

    const newAnswers = [...quizAnswers, { questionId: question.id, userAnswer: answerIndex }]
    setQuizAnswers(newAnswers)

    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex((i) => i + 1)
    } else {
      const result = scoreQuiz(newAnswers, quizQuestions)
      setQuizResult(result)
      setTeachingState(result.passed ? "quiz_result_pass" : "quiz_result_fail")
    }
  }

  async function retakeQuiz() {
    if (generatingQuiz || !quizResult) return
    setGeneratingQuiz(true)
    try {
      const questions = await generateAdaptiveQuiz(
        goalTitle,
        task,
        messages,
        quizResult.weakAreas,
        selectedModel,
      )
      setQuizQuestions(questions)
      setCurrentQuizIndex(0)
      setQuizAnswers([])
      setQuizResult(null)
      setTeachingState("quiz_active")
    } catch {
      // keep showing result screen
    } finally {
      setGeneratingQuiz(false)
    }
  }

  function startRecap() {
    setTeachingState("recap")
  }

  return {
    teachingState,
    phases,
    currentPhase,
    currentPhaseIndex,
    totalPhases: phases.length,
    showAdvanceCard,
    quizQuestions,
    currentQuizIndex,
    quizAnswers,
    quizResult,
    generatingQuiz,
    planError,
    teachingContext,
    handleAIMarkers,
    advancePhase,
    stayInPhase,
    startQuiz,
    answerQuizQuestion,
    retakeQuiz,
    startRecap,
  }
}
