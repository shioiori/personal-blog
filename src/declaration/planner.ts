export type PlannerStatus = 'undone' | 'partial' | 'done'

export interface PlannerTask {
  id: number
  date: string
  endDate: string | null
  text: string
  status: PlannerStatus
  categoryId: number | null
  parentId: number | null
  position: number
}

export interface PlannerCategory {
  id: number
  name: string
  color: string
}
