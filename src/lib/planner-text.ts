import type { PlannerStatus, PlannerTask } from '@/src/declaration/planner'
import { isWithin, rangeEnd, type DateRange } from './planner-range'

export type ParsedSubtask = Pick<PlannerTask, 'text' | 'status' | 'date' | 'endDate'>
export type ParsedTask = ParsedSubtask & { subtasks: ParsedSubtask[] }

const DATE = '(\\d{2})\\/(\\d{2})\\/(\\d{4})'
const RANGE = `${DATE}(?:\\s*-\\s*${DATE})?`
const HEADER = new RegExp(`^${RANGE}$`)
const RANGE_SUFFIX = new RegExp(`\\s*\\(${RANGE}\\)$`)
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

function parseRange(match: RegExpMatchArray): DateRange | null {
  const date = toIso(match[1], match[2], match[3])
  const end = match[4] ? toIso(match[4], match[5], match[6]) : null
  if (!date || (match[4] && (!end || end < date))) return null
  return { date, endDate: end && end > date ? end : null }
}

function formatRange(range: DateRange) {
  return range.endDate ? `${toDisplay(range.date)} - ${toDisplay(range.endDate)}` : toDisplay(range.date)
}

function formatItem(item: ParsedSubtask, depth: number, parent?: DateRange) {
  const ownRange = parent && (item.date !== parent.date || rangeEnd(item) !== rangeEnd(parent)) ? ` (${formatRange(item)})` : ''
  return `${'\t'.repeat(depth)}- ${MARKERS[item.status]} ${item.text}${ownRange}`
}

export function formatTasks(tasks: ParsedTask[]) {
  const groups = new Map<string, ParsedTask[]>()
  for (const task of [...tasks].sort((a, b) => a.date.localeCompare(b.date) || (a.endDate ?? '').localeCompare(b.endDate ?? ''))) {
    const key = formatRange(task)
    groups.set(key, [...(groups.get(key) ?? []), task])
  }
  return [...groups]
    .map(([header, items]) => [header, ...items.flatMap((x) => [formatItem(x, 1), ...x.subtasks.map((s) => formatItem(s, 2, x))])].join('\n'))
    .join('\n')
}

export function parseTasks(text: string): { tasks: ParsedTask[] } | { errorLine: number } {
  const tasks: ParsedTask[] = []
  let group: DateRange | null = null
  let parentIndent: number | null = null
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const header = line.trim().match(HEADER)
    if (header && !/^\s/.test(line)) {
      group = parseRange(header)
      if (!group) return { errorLine: i + 1 }
      parentIndent = null
      continue
    }
    const item = line.match(ITEM)
    if (!item || !group) return { errorLine: i + 1 }
    const indent = item[1].replace(/\t/g, '    ').length
    const marker = item[2]?.trim().toLowerCase()
    const status: PlannerStatus = marker === '[x]' ? 'done' : marker === '[~]' ? 'partial' : 'undone'
    parentIndent ??= indent
    if (indent <= parentIndent) {
      tasks.push({ ...group, text: item[3], status, subtasks: [] })
      continue
    }
    const suffix = item[3].match(RANGE_SUFFIX)
    const range = suffix?.index ? parseRange(suffix) : group
    if (!range || !isWithin(range, group)) return { errorLine: i + 1 }
    tasks[tasks.length - 1].subtasks.push({ text: suffix?.index ? item[3].slice(0, suffix.index) : item[3], status, ...range })
  }
  return { tasks: tasks.map((t) => (t.subtasks.length ? { ...t, status: deriveStatus(t.subtasks) } : t)) }
}
