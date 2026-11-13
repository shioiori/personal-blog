import type { PlannerTask } from '@/src/declaration/planner'

export type ParsedTask = Pick<PlannerTask, 'date' | 'endDate' | 'text' | 'checked'>

const HEADER = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s*-\s*(\d{2})\/(\d{2})\/(\d{4}))?$/
const ITEM = /^\s*-\s*(\[[xX]\]\s*)?(.*\S)\s*$/

function toIso(d: string, m: string, y: string) {
  const iso = `${y}-${m}-${d}`
  const date = new Date(`${iso}T00:00:00Z`)
  return !isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null
}

function toDisplay(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatTasks(tasks: ParsedTask[]) {
  const groups = new Map<string, ParsedTask[]>()
  for (const task of [...tasks].sort((a, b) => a.date.localeCompare(b.date) || (a.endDate ?? '').localeCompare(b.endDate ?? ''))) {
    const key = task.endDate ? `${toDisplay(task.date)} - ${toDisplay(task.endDate)}` : toDisplay(task.date)
    groups.set(key, [...(groups.get(key) ?? []), task])
  }
  return [...groups].map(([header, items]) => [header, ...items.map((x) => `\t- ${x.checked ? '[x] ' : ''}${x.text}`)].join('\n')).join('\n')
}

export function parseTasks(text: string): { tasks: ParsedTask[] } | { errorLine: number } {
  const tasks: ParsedTask[] = []
  let group: { date: string; endDate: string | null } | null = null
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
      continue
    }
    const item = line.match(ITEM)
    if (!item || !group) return { errorLine: i + 1 }
    tasks.push({ ...group, text: item[2], checked: !!item[1] })
  }
  return { tasks }
}
