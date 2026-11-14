export interface PlannerTask {
  id: number
  date: string
  endDate: string | null
  text: string
  checked: boolean
  categoryId: number | null
}

export interface PlannerCategory {
  id: number
  name: string
  color: string
}
