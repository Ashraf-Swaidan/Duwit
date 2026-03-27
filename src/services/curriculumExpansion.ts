import type { Goal, GoalProfile, Task } from "@/services/goals"
import { generateTeachingPlan } from "@/services/taskTeaching"
import { validateLessonStepsForTask, validatePlanCurriculum } from "@/services/curriculumValidation"
import type { LessonStep } from "@/types/curriculum"
import type { UserProfile } from "@/services/user"
import { buildTeachingLearnerContext } from "@/services/user"

const CONCURRENCY = 3
const MAX_ATTEMPTS = 3

type ExpansionJob = {
  phaseIndex: number
  taskIndex: number
  phaseTitle: string
  task: Task
  siblingTitles: string[]
}

function collectJobs(goal: Goal): ExpansionJob[] {
  const jobs: ExpansionJob[] = []
  for (let pi = 0; pi < goal.phases.length; pi++) {
    const phase = goal.phases[pi]
    const titles = phase.tasks.map((t) => t.title)
    for (let ti = 0; ti < phase.tasks.length; ti++) {
      jobs.push({
        phaseIndex: pi,
        taskIndex: ti,
        phaseTitle: phase.title,
        task: phase.tasks[ti],
        siblingTitles: titles.filter((_, i) => i !== ti),
      })
    }
  }
  return jobs
}

async function expandOneTask(
  goalTitle: string,
  job: ExpansionJob,
  modelName?: string,
  learnerContext?: string,
): Promise<LessonStep[]> {
  let lastErr: Error | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const steps = await generateTeachingPlan(
        goalTitle,
        job.phaseTitle,
        job.task,
        modelName,
        job.siblingTitles,
        learnerContext,
      )
      const probe: Task = { ...job.task, lessonSteps: steps }
      const errs = validateLessonStepsForTask(probe, "expanded")
      if (errs.length === 0) return steps as LessonStep[]
      lastErr = new Error(errs.join("; "))
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
  }
  throw lastErr ?? new Error("Curriculum expansion failed")
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  async function worker() {
    while (true) {
      const idx = cursor++
      if (idx >= items.length) break
      results[idx] = await fn(items[idx], idx)
    }
  }

  const n = Math.min(limit, Math.max(1, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

/**
 * Fills `lessonSteps` on every task. Throws if any task fails after retries.
 * Caller should run `validatePlanCurriculum` before save; this function runs it at the end.
 */
export type ExpandCurriculumOptions = {
  userProfile?: UserProfile | null
  goalProfile?: GoalProfile
}

export async function expandCurriculumForPlan(
  goalDraft: Goal,
  modelName?: string,
  onProgress?: (done: number, total: number) => void,
  options?: ExpandCurriculumOptions,
): Promise<Goal> {
  const learnerContext = buildTeachingLearnerContext(options?.userProfile, options?.goalProfile)
  const jobs = collectJobs(goalDraft)
  const total = jobs.length
  if (total === 0) {
    throw new Error("No tasks to expand")
  }

  let completed = 0
  const report = () => {
    onProgress?.(completed, total)
  }
  report()

  const lessonResults = await mapPool(jobs, CONCURRENCY, async (job, _i) => {
    const steps = await expandOneTask(goalDraft.title, job, modelName, learnerContext)
    completed++
    report()
    return { phaseIndex: job.phaseIndex, taskIndex: job.taskIndex, steps }
  })

  const next: Goal = {
    ...goalDraft,
    curriculumSchemaVersion: 1,
    phases: goalDraft.phases.map((p) => ({
      ...p,
      tasks: p.tasks.map((t) => ({ ...t })),
    })),
  }

  for (const r of lessonResults) {
    const t = next.phases[r.phaseIndex]?.tasks[r.taskIndex]
    if (t) t.lessonSteps = r.steps
  }

  const { ok, errors } = validatePlanCurriculum(next)
  if (!ok) {
    throw new Error(errors[0] ?? "Curriculum validation failed")
  }

  return next
}
