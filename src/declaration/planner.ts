export type PlannerStatus = 'undone' | 'partial' | 'done'

export interface PlannerTask {
  id: number
  date: string
  endDate: string | null
  text: string
  status: PlannerStatus
  /** 0–100; for a task with subtasks this is its effective progress. */
  progress: number
  /** Value the user dragged a parent to; null when it only follows its subtasks. */
  manualProgress: number | null
  categoryId: number | null
  parentId: number | null
  position: number
  notes: string
}

export interface PlannerCategory {
  id: number
  name: string
  color: string
}
