import { useState, useEffect, useRef, useMemo } from "react"
import type { Task, ChatMessage, GoalProfile } from "@/services/goals"
import type { UserProfile } from "@/services/user"
import { buildTeachingLearnerContext } from "@/services/user"
import { validateLessonStepsForTask } from "@/services/curriculumValidation"
import {
  type TeachingState,
  type TeachingPhase,
  type QuizQuestion,
  type QuizAnswer,
  type QuizResult,
  type TaskTeachingPersistV1,
  buildTaskTeachingPersistV1,
  generateTeachingPlan,
  generateAdaptiveQuiz,
  scoreQuiz,
  TASK_COMPLETE_SUGGEST_MARKER,
} from "@/services/taskTeaching"
import type { TeachingContext } from "@/services/prompts"

interface UseTaskTeachingOptions {
  task: Task
  goalTitle: string
  phaseTitle: string
  messages: ChatMessage[]
  selectedModel?: string
  /** True after Firestore load (or empty) has finished */
  historyReady: boolean
  /** Snapshot from Firestore; null if missing or invalid */
  persistedTeaching: TaskTeachingPersistV1 | null
  /** Current message count — used only at bootstrap (guarded by bootstrappedRef) */
  messagesLength: number
  /** Increment to wipe teaching state and re-bootstrap (e.g. clear chat) */
  sessionKey: number
  /** Stable id for this task chat (e.g. goalId-phaseIndex-taskIndex) */
  taskScopeKey: string
  /** Titles of other tasks in the same plan phase — excluded from micro-curriculum focus */
  siblingTaskTitles?: string[]
  userProfile?: UserProfile | null
  goalProfile?: GoalProfile
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
  /** Model suggested marking the whole task done */
  offerTaskCompleteSuggest: boolean
  quizQuestions: QuizQuestion[]
  currentQuizIndex: number
  quizAnswers: QuizAnswer[]
  quizResult: QuizResult | null
  generatingQuiz: boolean
  planError: boolean
  /** Context object that TaskChat passes to the system prompt generator */
  teachingContext: TeachingContext | undefined
  dismissTaskCompleteSuggest: () => void
  handleAIMarkers: (rawResponse: string) => string
  advancePhase: () => void
  advancePhaseAndGetContinuePrompt: () => string
  stayInPhase: () => void
  startQuiz: () => Promise<void>
  answerQuizQuestion: (answerIndex: number) => void
  retakeQuiz: () => Promise<void>
  startRecap: () => void
  /** Build payload for Firestore */
  getTeachingPersist: (
    checklistSelections?: Record<string, number[]>,
  ) => TaskTeachingPersistV1 | null
}

function coerceTeachingState(s: TeachingState | null): TeachingState | null {
  if (s === "loading") return "teaching"
  return s
}

export function useTaskTeaching({
  task,
  goalTitle,
  phaseTitle,
  messages,
  selectedModel,
  historyReady,
  persistedTeaching,
  messagesLength,
  sessionKey,
  taskScopeKey,
  siblingTaskTitles,
  userProfile,
  goalProfile,
}: UseTaskTeachingOptions): UseTaskTeachingReturn {
  const teachingLearnerContext = useMemo(
    () => buildTeachingLearnerContext(userProfile, goalProfile),
    [userProfile, goalProfile],
  )
  const [teachingState, setTeachingState] = useState<TeachingState | null>(null)
  const [phases, setPhases] = useState<TeachingPhase[]>([])
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0)
  const [showAdvanceCard, setShowAdvanceCard] = useState(false)
  const [offerTaskCompleteSuggest, setOfferTaskCompleteSuggest] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([])
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  const [generatingQuiz, setGeneratingQuiz] = useState(false)
  const [planError, setPlanError] = useState(false)

  const bootstrappedRef = useRef(false)
  const phaseIndexRef = useRef(0)

  const lessonStepsFingerprint = useMemo(
    () => (task.lessonSteps?.length ? JSON.stringify(task.lessonSteps) : ""),
    [task.lessonSteps],
  )

  useEffect(() => {
    phaseIndexRef.current = currentPhaseIndex
  }, [currentPhaseIndex])

  // Reset all local teaching state when session or task scope changes
  useEffect(() => {
    bootstrappedRef.current = false
    setTeachingState(null)
    setPhases([])
    setCurrentPhaseIndex(0)
    phaseIndexRef.current = 0
    setShowAdvanceCard(false)
    setOfferTaskCompleteSuggest(false)
    setQuizQuestions([])
    setCurrentQuizIndex(0)
    setQuizAnswers([])
    setQuizResult(null)
    setGeneratingQuiz(false)
    setPlanError(false)
  }, [sessionKey, taskScopeKey])

  /**
   * Bootstrap teaching state:
   * - If task.lessonSteps validates: canonical curriculum from goal; compare to teachingPersist
   *   (titles + lengths + phaseNum). Mismatch → reset phases from goal, index 0, clear quiz.
   * - Else legacy: hydrate persist or generateTeachingPlan.
   */
  useEffect(() => {
    if (!historyReady || bootstrappedRef.current) return
    bootstrappedRef.current = true

    const p = persistedTeaching
    const goalBacked =
      !!task.lessonSteps?.length &&
      validateLessonStepsForTask(task, "task").length === 0

    if (goalBacked && task.lessonSteps) {
      const G = task.lessonSteps as TeachingPhase[]
      const P = p?.v === 1 && Array.isArray(p.phases) ? p.phases : []

      const structureOk =
        P.length === G.length &&
        G.every((g, i) => {
          const pp = P[i]
          if (!pp) return false
          return (
            (pp.title ?? "").trim() === (g.title ?? "").trim() &&
            pp.phaseNum === i + 1 &&
            g.phaseNum === i + 1
          )
        })

      if (!structureOk) {
        setPhases(G)
        setCurrentPhaseIndex(0)
        phaseIndexRef.current = 0
        setTeachingState("teaching")
        setShowAdvanceCard(false)
        setOfferTaskCompleteSuggest(false)
        setQuizQuestions([])
        setCurrentQuizIndex(0)
        setQuizAnswers([])
        setQuizResult(null)
        return
      }

      setPhases(G)
      const idx = Math.min(
        Math.max(0, p?.currentPhaseIndex ?? 0),
        Math.max(0, G.length - 1),
      )
      setCurrentPhaseIndex(idx)
      phaseIndexRef.current = idx
      setTeachingState(coerceTeachingState(p?.teachingState ?? null))
      setShowAdvanceCard(!!p?.showAdvanceCard)
      setOfferTaskCompleteSuggest(!!p?.offerTaskCompleteSuggest)
      setQuizQuestions(Array.isArray(p?.quizQuestions) ? p.quizQuestions : [])
      setCurrentQuizIndex(typeof p?.currentQuizIndex === "number" ? p.currentQuizIndex : 0)
      setQuizAnswers(Array.isArray(p?.quizAnswers) ? p.quizAnswers : [])
      setQuizResult(p?.quizResult ?? null)
      return
    }

    if (p?.v === 1 && Array.isArray(p.phases) && p.phases.length > 0) {
      setPhases(p.phases)
      const idx = Math.min(
        Math.max(0, p.currentPhaseIndex),
        Math.max(0, p.phases.length - 1),
      )
      setCurrentPhaseIndex(idx)
      phaseIndexRef.current = idx
      setTeachingState(coerceTeachingState(p.teachingState))
      setShowAdvanceCard(!!p.showAdvanceCard)
      setOfferTaskCompleteSuggest(!!p.offerTaskCompleteSuggest)
      setQuizQuestions(Array.isArray(p.quizQuestions) ? p.quizQuestions : [])
      setCurrentQuizIndex(
        typeof p.currentQuizIndex === "number" ? p.currentQuizIndex : 0,
      )
      setQuizAnswers(Array.isArray(p.quizAnswers) ? p.quizAnswers : [])
      setQuizResult(p.quizResult ?? null)
      return
    }

    if (messagesLength > 0) {
      setTeachingState("loading")
      generateTeachingPlan(
        goalTitle,
        phaseTitle,
        task,
        selectedModel,
        siblingTaskTitles,
        teachingLearnerContext,
      )
        .then((plan) => {
          setPhases(plan)
          setCurrentPhaseIndex(0)
          phaseIndexRef.current = 0
          setTeachingState("teaching")
        })
        .catch(() => {
          setPlanError(true)
          setTeachingState(null)
        })
      return
    }

    setTeachingState("loading")
    generateTeachingPlan(
      goalTitle,
      phaseTitle,
      task,
      selectedModel,
      siblingTaskTitles,
      teachingLearnerContext,
    )
      .then((plan) => {
        setPhases(plan)
        setCurrentPhaseIndex(0)
        phaseIndexRef.current = 0
        setTeachingState("teaching")
      })
      .catch(() => {
        setPlanError(true)
        setTeachingState(null)
      })
  }, [
    historyReady,
    sessionKey,
    taskScopeKey,
    persistedTeaching,
    messagesLength,
    goalTitle,
    phaseTitle,
    task.title,
    task.description,
    task.type,
    selectedModel,
    siblingTaskTitles,
    lessonStepsFingerprint,
    teachingLearnerContext,
  ])

  const currentPhase = phases[currentPhaseIndex] ?? null

  const teachingContext: TeachingContext | undefined = (() => {
    if (!teachingState || teachingState === "loading") return undefined
    if (
      teachingState === "quiz_active" ||
      teachingState === "quiz_result_pass" ||
      teachingState === "quiz_result_fail"
    )
      return undefined

    if (teachingState === "teaching") {
      const idx = phaseIndexRef.current
      const phaseForPrompt = phases[idx] ?? null
      if (phaseForPrompt) {
        return {
          state: "teaching",
          currentPhase: phaseForPrompt,
          totalPhases: phases.length,
        }
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
      const idx = phaseIndexRef.current
      if (phases.length > 0 && idx >= phases.length - 1) {
        setTeachingState("quiz_prompt")
      } else {
        setShowAdvanceCard(true)
      }
      return clean
    }

    if (rawResponse.includes(TASK_COMPLETE_SUGGEST_MARKER)) {
      clean = rawResponse.replaceAll(TASK_COMPLETE_SUGGEST_MARKER, "").trim()
      setOfferTaskCompleteSuggest(true)
      return clean
    }

    return clean
  }

  function advancePhase() {
    setShowAdvanceCard(false)
    setCurrentPhaseIndex((i) => {
      const next = Math.min(i + 1, Math.max(0, phases.length - 1))
      phaseIndexRef.current = next
      return next
    })
  }

  function advancePhaseAndGetContinuePrompt(): string {
    setShowAdvanceCard(false)
    // Must not read `next` from inside setState's updater — React may run it after this
    // function returns, so `next` would still be 0 and the user message would say "Phase 1".
    const i = phaseIndexRef.current
    const next = Math.min(i + 1, Math.max(0, phases.length - 1))
    phaseIndexRef.current = next
    setCurrentPhaseIndex(next)
    return `I'm ready for lesson step ${next + 1} of ${phases.length} for this checklist task (the next micro-curriculum step in this chat).`
  }

  function stayInPhase() {
    setShowAdvanceCard(false)
  }

  function dismissTaskCompleteSuggest() {
    setOfferTaskCompleteSuggest(false)
  }

  async function startQuiz() {
    if (generatingQuiz) return
    setGeneratingQuiz(true)
    try {
      const questions = await generateAdaptiveQuiz(
        goalTitle,
        task,
        messages,
        undefined,
        selectedModel,
      )
      setQuizQuestions(questions)
      setCurrentQuizIndex(0)
      setQuizAnswers([])
      setQuizResult(null)
      setTeachingState("quiz_active")
    } catch {
      /* keep quiz_prompt */
    } finally {
      setGeneratingQuiz(false)
    }
  }

  function answerQuizQuestion(answerIndex: number) {
    const question = quizQuestions[currentQuizIndex]
    if (!question) return

    const newAnswers = [
      ...quizAnswers,
      { questionId: question.id, userAnswer: answerIndex },
    ]
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
      /* keep result */
    } finally {
      setGeneratingQuiz(false)
    }
  }

  function startRecap() {
    setTeachingState("recap")
  }

  function getTeachingPersist(
    checklistSelections?: Record<string, number[]>,
  ): TaskTeachingPersistV1 | null {
    if (teachingState === "loading") return null
    if (!phases.length && teachingState === null) return null
    const ts = teachingState === null ? "teaching" : teachingState
    return buildTaskTeachingPersistV1({
      phases,
      currentPhaseIndex,
      teachingState: ts,
      showAdvanceCard,
      offerTaskCompleteSuggest,
      quizQuestions,
      currentQuizIndex,
      quizAnswers,
      quizResult,
      checklistSelections,
    })
  }

  return {
    teachingState,
    phases,
    currentPhase,
    currentPhaseIndex,
    totalPhases: phases.length,
    showAdvanceCard,
    offerTaskCompleteSuggest,
    quizQuestions,
    currentQuizIndex,
    quizAnswers,
    quizResult,
    generatingQuiz,
    planError,
    teachingContext,
    dismissTaskCompleteSuggest,
    handleAIMarkers,
    advancePhase,
    advancePhaseAndGetContinuePrompt,
    stayInPhase,
    startQuiz,
    answerQuizQuestion,
    retakeQuiz,
    startRecap,
    getTeachingPersist,
  }
}
