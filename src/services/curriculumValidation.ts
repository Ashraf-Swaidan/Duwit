import type { Goal, Task } from "@/services/goals"
import type { LessonStep } from "@/types/curriculum"

const TITLE_MAX = 80
const OBJECTIVE_MAX = 200

export function validateLessonStepsForTask(
  task: Pick<Task, "title" | "lessonSteps">,
  path: string,
): string[] {
  const errors: string[] = []
  const steps = task.lessonSteps
  if (!steps || steps.length === 0) {
    errors.push(`${path}: missing lessonSteps`)
    return errors
  }
  if (steps.length !== 3) {
    errors.push(`${path}: expected 3 lesson steps, got ${steps.length}`)
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] as LessonStep | undefined
    const sp = `${path} step ${i + 1}`
    if (!step) {
      errors.push(`${sp}: missing`)
      continue
    }
    if (step.phaseNum !== i + 1) {
      errors.push(`${sp}: phaseNum must be ${i + 1}, got ${step.phaseNum}`)
    }
    const t = (step.title ?? "").trim()
    if (!t.length) errors.push(`${sp}: empty title`)
    else if (t.length > TITLE_MAX) errors.push(`${sp}: title too long (${t.length} > ${TITLE_MAX})`)

    const objs = step.objectives
    if (!Array.isArray(objs)) {
      errors.push(`${sp}: objectives must be an array`)
      continue
    }
    if (objs.length < 2 || objs.length > 4) {
      errors.push(`${sp}: objectives length must be 2–4, got ${objs.length}`)
    }
    const seen = new Set<string>()
    for (let j = 0; j < objs.length; j++) {
      const o = (objs[j] ?? "").trim()
      if (!o.length) {
        errors.push(`${sp} objective ${j + 1}: empty`)
        continue
      }
      if (o.length > OBJECTIVE_MAX) {
        errors.push(`${sp} objective ${j + 1}: too long (${o.length} > ${OBJECTIVE_MAX})`)
      }
      const key = o.toLowerCase()
      if (seen.has(key)) {
        errors.push(`${sp} objective ${j + 1}: duplicate objective text`)
      }
      seen.add(key)
    }
  }

  return errors
}

export function validatePlanCurriculum(goal: Pick<Goal, "phases">): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const { phases } = goal
  if (!Array.isArray(phases) || phases.length === 0) {
    return { ok: false, errors: ["Goal has no phases"] }
  }

  for (let pi = 0; pi < phases.length; pi++) {
    const phase = phases[pi]
    const tasks = phase?.tasks
    if (!Array.isArray(tasks)) {
      errors.push(`Phase ${pi + 1}: tasks missing`)
      continue
    }
    for (let ti = 0; ti < tasks.length; ti++) {
      const task = tasks[ti]
      const path = `Phase ${pi + 1} › task ${ti + 1} "${task?.title ?? "?"}"`
      errors.push(...validateLessonStepsForTask(task, path))
    }
  }

  return { ok: errors.length === 0, errors }
}
