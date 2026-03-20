/** One lesson step inside a checklist task (stored as `lessonSteps`; UI may say "Phase"). */
export interface LessonStep {
  phaseNum: number
  title: string
  objectives: string[]
}
