import type { PlannerStatus } from '@/src/declaration/planner'

/** Progress earned from subtasks alone: each done subtask is worth 100 / n percent. */
export function autoProgress(children: { status: PlannerStatus }[]): number {
  if (!children.length) return 0
  const done = children.filter((c) => c.status === 'done').length
  if (done === children.length) return 100
  if (!done) return 0
  return Math.min(99, Math.max(1, Math.round((done * 100) / children.length)))
}

/**
 * A parent's progress after one of its subtasks changes: a value the user dragged to stays put
 * unless the subtasks alone are now further along.
 */
export function parentProgress(manual: number | null, children: { status: PlannerStatus }[]): number {
  return Math.max(manual ?? 0, autoProgress(children))
}

export function statusFromProgress(progress: number): PlannerStatus {
  return progress >= 100 ? 'done' : progress <= 0 ? 'undone' : 'partial'
}

/** Progress implied by picking a status directly; a partial task keeps its in-between value. */
export function progressForStatus(status: PlannerStatus, previous = 0): number {
  if (status === 'done') return 100
  if (status === 'undone') return 0
  return previous > 0 && previous < 100 ? previous : 50
}

export function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}
