import type { PlannerStatus, PlannerTask } from '@/src/declaration/planner'

export type ParsedSubtask = Pick<PlannerTask, 'text' | 'status'>
export type ParsedTask = Pick<PlannerTask, 'date' | 'endDate' | 'text' | 'status'> & { subtasks: ParsedSubtask[] }

const HEADER = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s*-\s*(\d{2})\/(\d{2})\/(\d{4}))?$/
const ITEM = /^(\s*)-\s*(\[[ xX~]\]\s*)?(.*\S)\s*$/
const MARKERS: Record<PlannerStatus, string> = { done: '[x]', partial: '[~]', undone: '[ ]' }

export function deriveStatus(children: { status: PlannerStatus }[]): PlannerStatus {
  if (children.every((c) => c.status === 'done')) return 'done'
  if (children.some((c) => c.status === 'done')) return 'partial'
  return 'undone'
}

function toIso(d: string, m: string, y: string) {
  const iso = `${y}-${m}-${d}`
  const date = new Date(`${iso}T00:00:00Z`)
  return !isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null
}

function toDisplay(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatItem(item: ParsedSubtask, depth: number) {
  return `${'\t'.repeat(depth)}- ${MARKERS[item.status]} ${item.text}`
}

export function formatTasks(tasks: ParsedTask[]) {
  const groups = new Map<string, ParsedTask[]>()
  for (const task of [...tasks].sort((a, b) => a.date.localeCompare(b.date) || (a.endDate ?? '').localeCompare(b.endDate ?? ''))) {
    const key = task.endDate ? `${toDisplay(task.date)} - ${toDisplay(task.endDate)}` : toDisplay(task.date)
    groups.set(key, [...(groups.get(key) ?? []), task])
  }
  return [...groups]
    .map(([header, items]) => [header, ...items.flatMap((x) => [formatItem(x, 1), ...x.subtasks.map((s) => formatItem(s, 2))])].join('\n'))
    .join('\n')
}

export function parseTasks(text: string): { tasks: ParsedTask[] } | { errorLine: number } {
  const tasks: ParsedTask[] = []
  let group: { date: string; endDate: string | null } | null = null
  let parentIndent: number | null = null
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const header = line.trim().match(HEADER)
    if (header && !/^\s/.test(line)) {
      const date = toIso(header[1], header[2], header[3])
      const end = header[4] ? toIso(header[4], header[5], header[6]) : null
      if (!date || (header[4] && (!end || end < date))) return { errorLine: i + 1 }
      group = { date, endDate: end && end > date ? end : null }
      parentIndent = null
      continue
    }
    const item = line.match(ITEM)
    if (!item || !group) return { errorLine: i + 1 }
    const indent = item[1].replace(/\t/g, '    ').length
    const marker = item[2]?.trim().toLowerCase()
    const entry: ParsedSubtask = { text: item[3], status: marker === '[x]' ? 'done' : marker === '[~]' ? 'partial' : 'undone' }
    parentIndent ??= indent
    if (indent > parentIndent) tasks[tasks.length - 1].subtasks.push(entry)
    else tasks.push({ ...group, ...entry, subtasks: [] })
  }
  return { tasks: tasks.map((t) => (t.subtasks.length ? { ...t, status: deriveStatus(t.subtasks) } : t)) }
}
