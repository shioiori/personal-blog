'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type FocusEvent, type MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { EventDragStopArg } from '@fullcalendar/interaction'
import { DateSelectArg, DatesSetArg, EventChangeArg } from '@fullcalendar/core'
import { CalendarDays, Maximize2, MessageSquareText, Minimize2, Plus, Sprout, WrapText, X } from 'lucide-react'
import { toast } from 'sonner'
import { PlannerCategory, PlannerStatus, PlannerTask } from '@/src/declaration/planner'
import { GardenTab } from '@/src/components/planner/GardenTab'
import { CATEGORY_COLORS, colorForTask } from '@/src/components/planner/colors'
import { SegmentText } from '@/src/components/planner/SegmentText'
import { ColumnResizeHandles, EQUAL_COLUMN_WIDTHS, columnWidthVars } from '@/src/components/planner/ColumnResizeHandles'
import { useAuth } from '@/src/context/auth'
import { Button } from '@/src/components/ui/Button'
import { Textarea } from '@/src/components/ui/Textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/Tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/Tooltip'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/Dialog'
import { deriveStatus, formatTasks } from '@/src/lib/planner-text'

const DRAFT_ID = 'draft'
const SUBTASK_DRAFT_PREFIX = 'subtask-draft-'
const STATUSES: PlannerStatus[] = ['undone', 'partial', 'done']

function derivedStatus(task: PlannerTask, all: PlannerTask[]): PlannerStatus {
  const children = all.filter((x) => x.parentId === task.id)
  return children.length ? deriveStatus(children) : task.status
}

function DateRangeFields({ date, endDate, onCommit }: { date: string; endDate: string | null; onCommit: (date: string, endDate: string | null) => void }) {
  const [start, setStart] = useState(date)
  const [end, setEnd] = useState(endDate ?? date)
  const invalid = !start || !end || start > end
  const className = `rounded-md border bg-background px-2 py-1 text-sm outline-none ${invalid ? 'border-destructive text-destructive' : ''}`

  function commit() {
    const nextEnd = end > start ? end : null
    if (!invalid && (start !== date || nextEnd !== endDate)) onCommit(start, nextEnd)
  }

  return (
    <div className="flex items-center gap-2">
      <input type="date" value={start} aria-invalid={invalid} onChange={(e) => setStart(e.target.value)} onBlur={commit} className={className} />
      <span className="text-muted-foreground">–</span>
      <input type="date" value={end} aria-invalid={invalid} onChange={(e) => setEnd(e.target.value)} onBlur={commit} className={className} />
    </div>
  )
}

/** A wavy waterline filling the bottom of the icon, used for the "partially done" status. */
function wavyFill(bar: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M0,6.5 Q1.5,5 3,6.5 T6,6.5 T9,6.5 T12,6.5 L12,12 L0,12 Z' fill='${bar}'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function statusCheckboxStyle(bar: string, status: PlannerStatus): CSSProperties {
  return {
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
    height: 12,
    width: 12,
    borderRadius: 9999,
    border: `2px solid ${bar}`,
    backgroundColor: status === 'done' ? bar : 'transparent',
    backgroundImage: status === 'partial' ? wavyFill(bar) : undefined,
    backgroundSize: 'cover',
    margin: 0
  }
}

function monthRange(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${new Date(y, date.getMonth() + 1, 0).getDate()}` }
}

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return toDateStr(date)
}

function byOrder(a: PlannerTask, b: PlannerTask) {
  return a.position - b.position || a.date.localeCompare(b.date) || a.id - b.id
}

function rowsAtColumn(row: Element, x: number) {
  return [...row.querySelectorAll<HTMLElement>('[data-task-id]')]
    .filter((el) => !el.closest('.fc-event-mirror'))
    .map((el) => {
      const rect = el.getBoundingClientRect()
      return { id: Number(el.dataset.taskId), left: rect.left, right: rect.right, midY: rect.top + rect.height / 2 }
    })
    .filter((r) => r.left <= x && x <= r.right)
    .sort((a, b) => a.midY - b.midY)
}

let measureContext: CanvasRenderingContext2D | null = null

function charIndexAtX(text: string, x: number, font: string) {
  measureContext ??= document.createElement('canvas').getContext('2d')
  if (!measureContext) return text.length
  measureContext.font = font
  let low = 0
  let high = text.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (measureContext.measureText(text.slice(0, mid)).width <= x) low = mid
    else high = mid - 1
  }
  return low
}

export default function PlannerPage() {
  const t = useTranslations('Planner')
  const { user, loading: authLoading } = useAuth()
  const [tasks, setTasks] = useState<PlannerTask[]>([])
  const [draft, setDraft] = useState<{ date: string; endDate: string | null } | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const rangeRef = useRef<{ from: string; to: string } | null>(null)
  const monthRef = useRef<{ from: string; to: string } | null>(null)
  const [importText, setImportText] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const [columnWidths, setColumnWidths] = useState<number[]>(EQUAL_COLUMN_WIDTHS)
  const [segmentEnds, setSegmentEnds] = useState<Record<string, Record<string, number>>>({})
  const [textMode, setTextMode] = useState<'truncate' | 'wrap'>('truncate')
  const [showTooltip, setShowTooltip] = useState(true)
  const [categories, setCategories] = useState<PlannerCategory[]>([])
  const [newCategoryOpen, setNewCategoryOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0])
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null)
  const [contextTaskId, setContextTaskId] = useState<number | null>(null)
  const [peekMode, setPeekMode] = useState(false)
  const [contextDate, setContextDate] = useState<string | null>(null)
  const [subtaskDraftParentId, setSubtaskDraftParentId] = useState<number | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('planner-text-mode')
    if (stored === 'wrap' || stored === 'truncate') setTextMode(stored)
    setShowTooltip(localStorage.getItem('planner-tooltip') !== 'off')
  }, [])

  useEffect(() => {
    if (!user) return
    fetch('/api/planner/categories').then(async (res) => {
      if (res.ok) setCategories(await res.json())
    })
  }, [user])

  async function handleCreateCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    const res = await request('/api/planner/categories', 'POST', { name, color: newCategoryColor })
    if (!res.ok) return
    const created = (await res.json()) as PlannerCategory
    setCategories((prev) => [...prev, created])
    setNewCategoryOpen(false)
    setNewCategoryName('')
    setNewCategoryColor(CATEGORY_COLORS[0])
  }

  async function handleDeleteCategory(categoryId: number) {
    const res = await request(`/api/planner/categories/${categoryId}`, 'DELETE')
    if (!res.ok) return
    setCategories((prev) => prev.filter((c) => c.id !== categoryId))
    setTasks((prev) => prev.map((t) => (t.categoryId === categoryId ? { ...t, categoryId: null } : t)))
  }

  async function handleAssignCategory(taskId: number, categoryId: number | null) {
    const previous = tasks.find((x) => x.id === taskId)?.categoryId ?? null
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, categoryId } : x)))
    const res = await request(`/api/planner/tasks/${taskId}`, 'PUT', { categoryId })
    if (!res.ok) setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, categoryId: previous } : x)))
  }

  const toggleTextMode = useCallback(() => {
    setTextMode((prev) => {
      const next = prev === 'wrap' ? 'truncate' : 'wrap'
      localStorage.setItem('planner-text-mode', next)
      return next
    })
  }, [])

  const toggleTooltip = useCallback(() => {
    setShowTooltip((prev) => {
      localStorage.setItem('planner-tooltip', prev ? 'off' : 'on')
      return !prev
    })
  }, [])

  const handleSegmentMeasure = useCallback((segmentKey: string, segmentStart: string, end: number) => {
    setSegmentEnds((prev) =>
      prev[segmentKey]?.[segmentStart] === end ? prev : { ...prev, [segmentKey]: { ...prev[segmentKey], [segmentStart]: end } }
    )
  }, [])

  const refetch = useCallback(async () => {
    if (!rangeRef.current) return
    const { from, to } = rangeRef.current
    const res = await fetch(`/api/planner/tasks?from=${from}&to=${to}`)
    if (res.ok) setTasks(await res.json())
  }, [])

  useEffect(() => {
    if (!draft && editingId === null && subtaskDraftParentId === null) return
    function handlePointerDown(e: PointerEvent) {
      const input = document.querySelector<HTMLInputElement>('[data-planner-input]')
      if (input && !input.contains(e.target as Node)) input.blur()
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [draft, editingId, subtaskDraftParentId])

  useEffect(() => {
    if (editingId === null) return
    const input = document.querySelector<HTMLInputElement>('[data-planner-input]')
    if (!input) return
    input.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [editingId])

  function handleDatesSet(arg: DatesSetArg) {
    rangeRef.current = { from: toDateStr(arg.start), to: toDateStr(arg.end) }
    monthRef.current = monthRange(arg.view.currentStart)
    refetch()
  }

  function monthText() {
    const month = monthRef.current
    if (!month) return ''
    return formatTasks(
      tasks
        .filter((x) => x.parentId === null && x.date <= month.to && (x.endDate ?? x.date) >= month.from)
        .sort(byOrder)
        .map((x) => ({ ...x, status: derivedStatus(x, tasks), subtasks: tasks.filter((c) => c.parentId === x.id).sort(byOrder) }))
    )
  }

  function handleExport() {
    const url = URL.createObjectURL(new Blob([monthText()], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `planner-${monthRef.current?.from.slice(0, 7)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportSave() {
    if (importText === null || !monthRef.current) return
    setImporting(true)
    const res = await fetch('/api/planner/import', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...monthRef.current, text: importText })
    }).catch(() => Response.error())
    setImporting(false)
    if (res.ok) {
      setImportText(null)
      return refetch()
    }
    const data = await res.json().catch(() => null)
    toast.error(data?.errorLine ? t('importLineError', { line: data.errorLine }) : t('saveError'))
  }

  function startDraft(date: string, endDate: string | null) {
    setEditingId(null)
    setDraft({ date, endDate })
  }

  function handleDoubleClick(e: MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.closest('.fc-event, .fc-daygrid-more-link, .fc-popover')) return
    const date = target.closest<HTMLElement>('.fc-daygrid-day')?.dataset.date
    if (date) startDraft(date, null)
  }

  function handleDayContextMenu(e: MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.closest('.fc-event, .fc-daygrid-more-link, .fc-popover')) return
    const date = target.closest<HTMLElement>('.fc-daygrid-day')?.dataset.date
    if (!date) return
    e.preventDefault()
    setContextDate(date)
  }

  function handleSelect(arg: DateSelectArg) {
    arg.view.calendar.unselect()
    const endDate = addDays(arg.endStr, -1)
    if (endDate > arg.startStr) startDraft(arg.startStr, endDate)
  }

  async function request(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).catch(() => Response.error())
    if (!res.ok) toast.error(t('saveError'))
    return res
  }

  async function handleSetStatus(taskId: number, status: PlannerStatus) {
    const previous = tasks.find((x) => x.id === taskId)?.status
    if (previous === undefined) return
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, status } : x)))
    const res = await request(`/api/planner/tasks/${taskId}`, 'PUT', { status })
    if (!res.ok) setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, status: previous } : x)))
  }

  // Plain click only ever flips between done/undone; "partial" is only reachable from the modal.
  function handleToggle(task: PlannerTask) {
    handleSetStatus(task.id, task.status === 'done' ? 'undone' : 'done')
  }

  // Clicking a task that has subtasks toggles all of them together instead of its own (derived) status.
  async function handleToggleGroup(children: PlannerTask[]) {
    if (!children.length) return
    const next: PlannerStatus = children.every((c) => c.status === 'done') ? 'undone' : 'done'
    const previous = children.map((c) => ({ id: c.id, status: c.status }))
    const ids = new Set(children.map((c) => c.id))
    setTasks((prev) => prev.map((x) => (ids.has(x.id) ? { ...x, status: next } : x)))
    const results: Response[] = []
    for (const c of children) results.push(await request(`/api/planner/tasks/${c.id}`, 'PUT', { status: next }))
    if (results.some((r) => !r.ok)) {
      setTasks((prev) => prev.map((x) => {
        const p = previous.find((pp) => pp.id === x.id)
        return p ? { ...x, status: p.status } : x
      }))
    }
  }

  async function handleRename(taskId: number, text: string) {
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, text } : x)))
    const res = await request(`/api/planner/tasks/${taskId}`, 'PUT', { text })
    if (!res.ok) return refetch()
  }

  async function handleUpdateNotes(taskId: number, notes: string) {
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, notes } : x)))
    const res = await request(`/api/planner/tasks/${taskId}`, 'PUT', { notes })
    if (!res.ok) refetch()
  }

  async function handleCreateSubtask(parentId: number, rawText: string) {
    const text = rawText.trim()
    if (!text) return
    const parent = tasks.find((x) => x.id === parentId)
    if (!parent) return
    const tempId = -Date.now()
    setTasks((prev) => [
      ...prev,
      { id: tempId, date: parent.date, endDate: null, text, status: 'undone', categoryId: null, parentId, position: Number.MAX_SAFE_INTEGER, notes: '' }
    ])
    const res = await request('/api/planner/tasks', 'POST', { date: parent.date, text, parentId })
    if (!res.ok) return setTasks((prev) => prev.filter((x) => x.id !== tempId))
    const created = (await res.json()) as PlannerTask
    setTasks((prev) => [...prev.filter((x) => x.id !== tempId), created])
  }

  async function handleMoveTask(taskId: number, date: string, endDate: string | null) {
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, date, endDate } : x.parentId === taskId ? { ...x, date } : x)))
    const res = await request(`/api/planner/tasks/${taskId}`, 'PUT', { date, endDate })
    if (!res.ok) refetch()
  }

  function handleEventChange(arg: EventChangeArg) {
    const date = arg.event.startStr
    const lastDay = arg.event.endStr ? addDays(arg.event.endStr, -1) : date
    handleMoveTask(Number(arg.event.id), date, lastDay > date ? lastDay : null)
  }

  async function handleReorder(ids: number[]) {
    const positions = new Map(ids.map((id, i) => [id, i + 1]))
    setTasks((prev) => prev.map((x) => {
      const position = positions.get(x.id)
      return position === undefined ? x : { ...x, position }
    }))
    const res = await request('/api/planner/tasks/reorder', 'PUT', { ids })
    if (!res.ok) refetch()
  }

  function handleEventDragStop(arg: EventDragStopArg) {
    gridRef.current?.classList.remove('planner-dragging')
    const { clientX: x, clientY: y } = arg.jsEvent
    const task = tasks.find((t) => t.id === Number(arg.event.id))
    const row = document.elementsFromPoint(x, y).find((el) => el.matches('.fc-daygrid-day'))?.closest('tr')
    if (!task || !row) return
    const current = tasks.filter((t) => t.parentId === task.parentId && t.id > 0).sort(byOrder)
    const others = current.filter((t) => t.id !== task.id)
    const visible = rowsAtColumn(row, x).filter((r) => others.some((t) => t.id === r.id))
    const index = visible.filter((r) => r.midY < y).length
    const anchor = visible[index] ?? visible[index - 1]
    if (!anchor) return
    const at = others.findIndex((t) => t.id === anchor.id) + (visible[index] ? 0 : 1)
    const ordered = [...others.slice(0, at), task, ...others.slice(at)]
    if (ordered.every((t, i) => t.id === current[i].id)) return
    handleReorder(ordered.map((t) => t.id))
  }

  async function handleDelete(taskId: number) {
    const isSubtask = !!tasks.find((x) => x.id === taskId)?.parentId
    const res = await request(`/api/planner/tasks/${taskId}`, 'DELETE')
    if (!res.ok) return
    setTasks((prev) => prev.filter((x) => x.id !== taskId))
    if (isSubtask) refetch()
  }

  async function handleCommit(e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>, taskId: number | null) {
    const input = e.currentTarget
    const cancelled = input.dataset.cancel === '1'
    const text = input.value.trim()
    const current = draft
    setDraft(null)
    setEditingId(null)
    if (cancelled) return
    if (taskId === null) {
      if (!text || !current) return
      const tempId = -Date.now()
      setTasks((prev) => [
        ...prev,
        { id: tempId, ...current, text, status: 'undone', categoryId: null, parentId: null, position: Number.MAX_SAFE_INTEGER, notes: '' }
      ])
      const res = await request('/api/planner/tasks', 'POST', { ...current, text })
      if (!res.ok) return setTasks((prev) => prev.filter((x) => x.id !== tempId))
      const created = (await res.json()) as PlannerTask
      setTasks((prev) => [...prev.filter((x) => x.id !== tempId && x.id !== created.id), created])
      return
    }
    if (!text) return handleDelete(taskId)
    if (text === tasks.find((x) => x.id === taskId)?.text) return
    const res = await request(`/api/planner/tasks/${taskId}`, 'PUT', { text })
    if (res.ok) setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, text } : x)))
  }

  function handleSubtaskDraftCommit(e: FocusEvent<HTMLInputElement>, parentId: number) {
    const input = e.currentTarget
    const cancelled = input.dataset.cancel === '1'
    const text = input.value.trim()
    setSubtaskDraftParentId(null)
    if (!cancelled && text) handleCreateSubtask(parentId, text)
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === 'Escape') e.currentTarget.dataset.cancel = '1'
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  // Renders a task the same way the calendar does: colored pill, status checkbox, inline-editable text.
  function renderTaskRow(task: PlannerTask, indent: boolean, asLink = false) {
    const color = colorForTask(task.id)
    const children = tasks.filter((x) => x.parentId === task.id)
    const hasChildren = children.length > 0
    const status: PlannerStatus = hasChildren ? derivedStatus(task, tasks) : task.status
    const category = task.categoryId ? categories.find((c) => c.id === task.categoryId) : undefined
    return (
      <div
        key={task.id}
        className="group flex items-center gap-1 rounded-md px-1.5 py-1"
        style={{ backgroundColor: `${color.bar}4D`, marginLeft: indent ? 16 : undefined }}
      >
        <input
          type="checkbox"
          checked={status === 'done'}
          ref={(el) => {
            if (el) el.indeterminate = status === 'partial'
          }}
          onChange={() => (hasChildren ? handleToggleGroup(children) : handleToggle(task))}
          className="shrink-0 cursor-pointer"
          style={statusCheckboxStyle(color.bar, status)}
        />
        {category && <span className="h-2 w-2 shrink-0 rounded-full" title={category.name} style={{ backgroundColor: category.color }} />}
        {asLink ? (
          <button
            type="button"
            onClick={() => setContextTaskId(task.id)}
            className={`min-w-0 flex-1 truncate text-left text-xs font-medium underline-offset-2 hover:underline ${status === 'done' ? 'line-through opacity-70' : ''}`}
            style={{ color: color.text }}
          >
            {task.text}
          </button>
        ) : (
          <input
            key={task.id}
            defaultValue={task.text}
            onBlur={(e) => {
              const text = e.target.value.trim()
              if (text && text !== task.text) handleRename(task.id, text)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={`min-w-0 flex-1 bg-transparent text-xs font-medium outline-none ${status === 'done' ? 'line-through opacity-70' : ''}`}
            style={{ color: color.text }}
          />
        )}
        {!indent && (
          <button
            type="button"
            title={t('addSubtask')}
            onClick={() => setSubtaskDraftParentId(task.id)}
            className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          aria-label={t('deleteTask')}
          onClick={() => handleDelete(task.id)}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  function renderTaskGroup(task: PlannerTask) {
    return (
      <div key={task.id} className="space-y-1">
        {renderTaskRow(task, false)}
        {renderSubtasks(task)}
      </div>
    )
  }

  function renderSubtasks(task: PlannerTask, asLink = false) {
    return (
      <>
        {tasks.filter((x) => x.parentId === task.id).sort(byOrder).map((child) => renderTaskRow(child, true, asLink))}
        {subtaskDraftParentId === task.id && (
          <div className="flex items-center gap-1 rounded-md px-1.5 py-1" style={{ marginLeft: 16 }}>
            <span className="shrink-0" style={{ height: 12, width: 12 }} />
            <input
              data-planner-input
              ref={(el) => {
                if (el) setTimeout(() => el.focus(), 0)
              }}
              placeholder={t('addSubtaskPlaceholder')}
              onBlur={(e) => handleSubtaskDraftCommit(e, task.id)}
              onKeyDown={handleInputKeyDown}
              className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
            />
          </div>
        )}
      </>
    )
  }

  function renderTaskPage(task: PlannerTask) {
    const status = derivedStatus(task, tasks)
    const hasChildren = tasks.some((x) => x.parentId === task.id)
    const isTopLevel = task.parentId === null
    return (
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-10 pb-10 pt-12">
        <button
          type="button"
          title={t('viewCompact')}
          aria-label={t('viewCompact')}
          onClick={() => setPeekMode(false)}
          className="absolute right-12 top-4 rounded-sm opacity-70 hover:opacity-100"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
        <DialogTitle className="sr-only">{t('taskDetails')}</DialogTitle>
        <input
          key={task.id}
          defaultValue={task.text}
          onBlur={(e) => {
            const text = e.target.value.trim()
            if (text && text !== task.text) handleRename(task.id, text)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={`w-full bg-transparent text-3xl font-bold outline-none ${status === 'done' ? 'line-through opacity-70' : ''}`}
        />
        <div className="grid grid-cols-[8rem_1fr] items-center gap-x-4 gap-y-3 text-sm">
          {isTopLevel && (
            <>
              <span className="text-muted-foreground">{t('dates')}</span>
              <DateRangeFields
                key={`${task.id}|${task.date}|${task.endDate}`}
                date={task.date}
                endDate={task.endDate}
                onCommit={(date, endDate) => handleMoveTask(task.id, date, endDate)}
              />
            </>
          )}
          <span className="text-muted-foreground">{t('status')}</span>
          {hasChildren ? (
            <span title={t('statusFromSubtasks')} className="border border-transparent px-2 py-1">
              {t(`status_${status}`)}
            </span>
          ) : (
            <select
              value={status}
              onChange={(e) => handleSetStatus(task.id, e.target.value as PlannerStatus)}
              className="w-fit rounded-md border bg-background px-2 py-1 outline-none"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status_${s}`)}
                </option>
              ))}
            </select>
          )}
          {isTopLevel && (
            <>
              <span className="text-muted-foreground">{t('category')}</span>
              <select
                value={task.categoryId ?? ''}
                onChange={(e) => handleAssignCategory(task.id, e.target.value ? Number(e.target.value) : null)}
                className="w-fit rounded-md border bg-background px-2 py-1 outline-none"
              >
                <option value="">{t('noCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <Textarea
          key={`notes-${task.id}`}
          defaultValue={task.notes}
          placeholder={t('notesPlaceholder')}
          onBlur={(e) => e.target.value !== task.notes && handleUpdateNotes(task.id, e.target.value)}
          className="min-h-32 resize-none border-none px-0 shadow-none focus-visible:ring-0"
        />
        {isTopLevel && (
          <div className="space-y-1 border-t pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">{t('subtasks')}</span>
              <button
                type="button"
                title={t('addSubtask')}
                aria-label={t('addSubtask')}
                onClick={() => setSubtaskDraftParentId(task.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {renderSubtasks(task, true)}
          </div>
        )}
      </div>
    )
  }

  const events = useMemo(() => {
    const items: { id: string; title: string; start: string; end?: string }[] = []
    for (const task of tasks.filter((t) => t.parentId === null).sort(byOrder)) {
      items.push({ id: String(task.id), title: task.text, start: task.date, end: task.endDate ? addDays(task.endDate, 1) : undefined })
      for (const child of tasks.filter((t) => t.parentId === task.id).sort(byOrder)) {
        items.push({ id: String(child.id), title: child.text, start: child.date })
      }
      if (subtaskDraftParentId === task.id) items.push({ id: `${SUBTASK_DRAFT_PREFIX}${task.id}`, title: '', start: task.date })
    }
    if (draft) items.push({ id: DRAFT_ID, title: '', start: draft.date, end: draft.endDate ? addDays(draft.endDate, 1) : undefined })
    return items.map((item, order) => {
      const isSpecial = item.id === DRAFT_ID || item.id.startsWith(SUBTASK_DRAFT_PREFIX)
      const taskId = isSpecial ? null : Number(item.id)
      const task = taskId !== null ? tasks.find((x) => x.id === taskId) : undefined
      const pending = taskId !== null && taskId < 0
      return {
        ...item,
        allDay: true,
        editable: !pending && !!task && item.id !== String(editingId),
        durationEditable: !!task && task.parentId === null,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        extendedProps: { order }
      }
    })
  }, [tasks, draft, editingId, subtaskDraftParentId])

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTextMode}
              title={textMode === 'wrap' ? t('textModeWrap') : t('textModeTruncate')}
              aria-label={textMode === 'wrap' ? t('textModeWrap') : t('textModeTruncate')}
              aria-pressed={textMode === 'wrap'}
              className={`h-9 w-9 ${textMode === 'wrap' ? 'bg-accent text-accent-foreground' : ''}`}
            >
              <WrapText className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTooltip}
              title={t('tooltipToggle')}
              aria-label={t('tooltipToggle')}
              aria-pressed={showTooltip}
              className={`h-9 w-9 ${showTooltip ? 'bg-accent text-accent-foreground' : ''}`}
            >
              <MessageSquareText className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={!user} onClick={handleExport}>
              {t('export')}
            </Button>
            <Button variant="outline" size="sm" disabled={!user} onClick={() => setImportText(monthText())}>
              {t('import')}
            </Button>
          </div>
        </div>

        <Dialog open={importText !== null} onOpenChange={(open) => !open && setImportText(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('importTitle')}</DialogTitle>
            </DialogHeader>
            <Textarea
              value={importText ?? ''}
              onChange={(e) => setImportText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return
                e.preventDefault()
                e.stopPropagation()
                if (!e.shiftKey) return document.execCommand('insertText', false, '\t')
                const el = e.currentTarget
                const start = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1
                const block = el.value.slice(start, el.selectionEnd)
                const outdented = block.replace(/^(\t| {1,4})/gm, '')
                if (outdented === block) return
                el.setSelectionRange(start, el.selectionEnd)
                document.execCommand('insertText', false, outdented)
              }}
              wrap="off"
              spellCheck={false}
              className="min-h-[50vh] max-h-[60vh] overflow-auto font-mono text-xs md:text-xs [tab-size:4]"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportText(null)} disabled={importing}>
                {t('cancel')}
              </Button>
              <Button onClick={handleImportSave} disabled={importing}>
                {t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {!authLoading && !user && (
          <p className="text-sm text-muted-foreground mb-4">{t('loginRequired')}</p>
        )}

        <Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('addCategory')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('categoryName')}</label>
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                  placeholder={t('categoryNamePlaceholder')}
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('categoryColor')}</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCategoryColor(color)}
                      className="h-6 w-6 rounded-full"
                      style={{ backgroundColor: color, outline: color === newCategoryColor ? '2px solid currentColor' : undefined, outlineOffset: 2 }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewCategoryOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
                {t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={contextTaskId !== null}
          onOpenChange={(open) => {
            if (open) return
            setContextTaskId(null)
            setSubtaskDraftParentId(null)
            setPeekMode(false)
          }}
        >
          {(() => {
            const contextTask = tasks.find((x) => x.id === contextTaskId)
            return (
              <DialogContent aria-describedby={undefined} className={peekMode ? 'h-[85dvh] max-w-3xl p-0' : 'max-w-md'}>
                {contextTask && peekMode && renderTaskPage(contextTask)}
                {contextTask && !peekMode && (
                  <>
                    <DialogHeader className="flex-row items-center gap-2 space-y-0 pr-8">
                      <DialogTitle>{t('taskDetails')}</DialogTitle>
                      <button
                        type="button"
                        title={t('viewPage')}
                        aria-label={t('viewPage')}
                        onClick={() => setPeekMode(true)}
                        className="ml-auto rounded-sm text-muted-foreground hover:text-foreground"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </DialogHeader>
                    <div className="space-y-1">{renderTaskGroup(contextTask)}</div>
                  </>
                )}
              </DialogContent>
            )
          })()}
        </Dialog>

        <Dialog
          open={contextDate !== null}
          onOpenChange={(open) => {
            if (open) return
            setContextDate(null)
            setSubtaskDraftParentId(null)
          }}
        >
          <DialogContent className="max-w-md">
            {contextDate && (
              <>
                <DialogHeader>
                  <DialogTitle>{contextDate}</DialogTitle>
                </DialogHeader>
                <div className="space-y-1 max-h-[60vh] overflow-auto">
                  {tasks
                    .filter((t) => t.parentId === null && t.date <= contextDate && (t.endDate ?? t.date) >= contextDate)
                    .sort(byOrder)
                    .map((task) => renderTaskGroup(task))}
                  {tasks.filter((t) => t.parentId === null && t.date <= contextDate && (t.endDate ?? t.date) >= contextDate).length === 0 && (
                    <p className="text-sm text-muted-foreground">{t('noTasks')}</p>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {t('tabCalendar')}
            </TabsTrigger>
            <TabsTrigger value="garden" className="flex items-center gap-2">
              <Sprout className="h-4 w-4" />
              {t('tabGarden')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
        {user && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground">{t('categories')}</span>
            {categories.map((cat) => (
              <span
                key={cat.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/planner-category-id', String(cat.id))}
                title={cat.name}
                className="group flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs cursor-grab active:cursor-grabbing"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name}
                <button
                  type="button"
                  aria-label={t('deleteCategory')}
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              title={t('addCategory')}
              aria-label={t('addCategory')}
              onClick={() => setNewCategoryOpen(true)}
            >
              <Plus className="h-3 w-3" />
            </Button>
            {categories.length > 0 && <span className="text-xs text-muted-foreground">{t('dragCategoryHint')}</span>}
          </div>
        )}
        <div className="w-full overflow-x-auto no-scrollbar planner-calendar">
          <div
            ref={gridRef}
            className="relative min-w-[640px]"
            style={columnWidthVars(columnWidths)}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleDayContextMenu}
          >
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: ''
              }}
              height="auto"
              selectable
              editable
              eventOrder={(a, b) => ((a as { extendedProps: { order: number } }).extendedProps.order - (b as { extendedProps: { order: number } }).extendedProps.order)}
              select={handleSelect}
              eventChange={handleEventChange}
              eventAllow={(span, moving) => {
                const task = tasks.find((x) => x.id === Number(moving?.id))
                return !task?.parentId || span.startStr === moving?.startStr
              }}
              eventDragStart={() => gridRef.current?.classList.add('planner-dragging')}
              eventDragStop={handleEventDragStop}
              datesSet={handleDatesSet}
              eventContent={(info) => {
                const isDraft = info.event.id === DRAFT_ID
                const isSubtaskDraft = info.event.id.startsWith(SUBTASK_DRAFT_PREFIX)
                const subtaskDraftParent = isSubtaskDraft ? Number(info.event.id.slice(SUBTASK_DRAFT_PREFIX.length)) : null
                const taskId = isDraft || isSubtaskDraft ? null : Number(info.event.id)
                const task = taskId !== null ? tasks.find((x) => x.id === taskId) : undefined
                const pending = taskId !== null && taskId < 0
                const readOnly = taskId === null || pending
                const isSubtask = !!task?.parentId
                const children = task && !task.parentId ? tasks.filter((x) => x.parentId === task.id) : []
                const hasChildren = children.length > 0
                const status: PlannerStatus = task ? (hasChildren ? derivedStatus(task, tasks) : task.status) : 'undone'
                const color = colorForTask(pending ? DRAFT_ID : info.event.id)
                const categoryId = task?.categoryId ?? null
                const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined
                const editing = (isDraft || taskId === editingId) && info.isStart
                const segmentKey = `${info.event.id}|${info.event.startStr}|${info.event.endStr}|${info.event.title}`
                const wrap = textMode === 'wrap'
                const content = (
                  <div
                    data-task-id={task?.id}
                    className={`group flex items-center gap-1 w-full cursor-pointer active:cursor-grabbing ${info.isStart ? 'pl-0.5' : ''} ${pending ? 'opacity-60' : ''} ${wrap ? 'items-start' : ''} ${wrap ? '' : 'overflow-hidden'}`}
                    style={{ paddingLeft: isSubtask || isSubtaskDraft ? 16 : undefined }}
                    onContextMenu={(e) => {
                      if (readOnly || isDraft || isSubtaskDraft) return
                      e.preventDefault()
                      e.stopPropagation()
                      setContextTaskId(taskId)
                    }}
                  >
                    {info.isStart && isSubtaskDraft && <span className="shrink-0" style={{ height: 12, width: 12 }} />}
                    {info.isStart && !isSubtaskDraft && (
                      <input
                        type="checkbox"
                        checked={status === 'done'}
                        ref={(el) => {
                          if (el) el.indeterminate = status === 'partial'
                        }}
                        disabled={readOnly}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => {
                          if (readOnly || !task) return
                          if (hasChildren) handleToggleGroup(children)
                          else handleToggle(task)
                        }}
                        className={`shrink-0 cursor-pointer ${wrap ? 'mt-1' : ''}`}
                        style={statusCheckboxStyle(color.bar, status)}
                      />
                    )}
                    <div
                      className="flex min-w-0 flex-1 items-center gap-1 px-1.5 py-px"
                      style={{
                        backgroundColor: `${color.bar}4D`,
                        borderTopLeftRadius: info.isStart ? 6 : 0,
                        borderBottomLeftRadius: info.isStart ? 6 : 0,
                        borderTopRightRadius: info.isEnd ? 6 : 0,
                        borderBottomRightRadius: info.isEnd ? 6 : 0,
                        boxShadow: dragOverTaskId === taskId && !readOnly ? 'inset 0 0 0 2px currentColor' : undefined
                      }}
                      onDragOver={(e) => {
                        if (readOnly || isSubtask || !e.dataTransfer.types.includes('text/planner-category-id')) return
                        e.preventDefault()
                        setDragOverTaskId(taskId)
                      }}
                      onDragLeave={() => setDragOverTaskId((prev) => (prev === taskId ? null : prev))}
                      onDrop={(e) => {
                        setDragOverTaskId(null)
                        if (readOnly || isSubtask) return
                        const dropped = e.dataTransfer.getData('text/planner-category-id')
                        if (!dropped) return
                        e.preventDefault()
                        handleAssignCategory(taskId as number, Number(dropped))
                      }}
                    >
                      {info.isStart && category && (
                        <span
                          title={category.name}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            if (!readOnly) handleAssignCategory(taskId as number, null)
                          }}
                          className="h-2 w-2 shrink-0 rounded-full cursor-pointer"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      {isSubtaskDraft ? (
                        <input
                          data-planner-input
                          autoFocus
                          placeholder={t('addSubtaskPlaceholder')}
                          onBlur={(e) => handleSubtaskDraftCommit(e, subtaskDraftParent as number)}
                          onKeyDown={handleInputKeyDown}
                          className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                          style={{ color: color.text }}
                        />
                      ) : editing && wrap ? (
                        <textarea
                          data-planner-input
                          autoFocus
                          rows={1}
                          defaultValue={info.event.title}
                          placeholder={t('taskPlaceholder')}
                          onBlur={(e) => handleCommit(e, taskId)}
                          onKeyDown={handleInputKeyDown}
                          onFocus={(e) => {
                            const el = e.currentTarget
                            el.style.height = 'auto'
                            el.style.height = `${el.scrollHeight}px`
                          }}
                          onInput={(e) => {
                            const el = e.currentTarget
                            el.style.height = 'auto'
                            el.style.height = `${el.scrollHeight}px`
                          }}
                          className="min-w-0 flex-1 resize-none bg-transparent text-xs font-medium outline-none"
                          style={{ color: color.text, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                        />
                      ) : editing ? (
                        <input
                          data-planner-input
                          autoFocus
                          defaultValue={info.event.title}
                          placeholder={t('taskPlaceholder')}
                          onBlur={(e) => handleCommit(e, taskId)}
                          onKeyDown={handleInputKeyDown}
                          onMouseDown={(e) => {
                            // FullCalendar's interaction plugin preventDefaults mousedown on
                            // .fc-event to suppress native drag/selection, which also blocks the
                            // browser's native click-to-reposition-caret behavior here. Compute
                            // and apply the caret position ourselves instead of relying on it.
                            const input = e.currentTarget
                            const x = e.clientX - input.getBoundingClientRect().left
                            const index = charIndexAtX(input.value, x, getComputedStyle(input).font)
                            requestAnimationFrame(() => input.setSelectionRange(index, index))
                          }}
                          className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                          style={{ color: color.text }}
                        />
                      ) : wrap ? (
                        <>
                          <span
                            className={`min-w-0 flex-1 text-xs font-medium ${status === 'done' ? 'line-through opacity-70' : status === 'partial' ? 'opacity-70' : ''}`}
                            style={{ color: color.text, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            onClick={() => {
                              if (readOnly) return
                              setDraft(null)
                              setEditingId(taskId)
                            }}
                          >
                            {info.isStart ? info.event.title || ' ' : ' '}
                          </span>
                          {!readOnly && !isSubtask && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSubtaskDraftParentId(taskId)
                              }}
                              title={t('addSubtask')}
                              className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(taskId)
                              }}
                              className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <SegmentText
                            text={info.event.title}
                            segmentKey={segmentKey}
                            ends={segmentEnds[segmentKey]}
                            isEnd={info.isEnd}
                            onMeasure={handleSegmentMeasure}
                            className={`min-w-0 flex-1 truncate text-xs font-medium ${status === 'done' ? 'line-through opacity-70' : status === 'partial' ? 'opacity-70' : ''}`}
                            style={{ color: color.text }}
                            onClick={() => {
                              if (readOnly) return
                              setDraft(null)
                              setEditingId(taskId)
                            }}
                          />
                          {!readOnly && !isSubtask && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSubtaskDraftParentId(taskId)
                              }}
                              title={t('addSubtask')}
                              className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(taskId)
                              }}
                              className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
                if (!task || editing || !showTooltip) return content
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs whitespace-normal break-words">
                      {task.text}
                    </TooltipContent>
                  </Tooltip>
                )
              }}
              events={events}
            />
            <ColumnResizeHandles containerRef={gridRef} widths={columnWidths} onChange={setColumnWidths} />
          </div>
        </div>
          </TabsContent>

          <TabsContent value="garden">
            {user && <GardenTab />}
          </TabsContent>
        </Tabs>
      </div>

      <style jsx global>{`
        .planner-calendar .fc-button {
          background-color: #eef2ff;
          border-color: #c7d2fe;
          color: #4338ca;
          text-transform: capitalize;
          box-shadow: none;
        }
        .planner-calendar .fc-button:hover {
          background-color: #e0e7ff;
          border-color: #a5b4fc;
          color: #4338ca;
        }
        .planner-calendar .fc-button:disabled {
          background-color: #eef2ff;
          border-color: #c7d2fe;
          color: #a5b4fc;
          opacity: 1;
        }
        .planner-calendar .fc-button-active,
        .planner-calendar .fc-button:focus {
          box-shadow: none !important;
        }
        .planner-calendar .fc-toolbar-title {
          color: #4338ca;
        }
        .planner-calendar .fc-event {
          background: transparent;
          border: none;
          padding: 0;
        }
        .planner-calendar .fc-daygrid-event {
          margin-top: 2px;
        }
        .planner-calendar .fc-daygrid-bg-harness {
          pointer-events: none;
        }
        .planner-dragging,
        .planner-dragging * {
          cursor: grabbing !important;
        }
      `}</style>
    </div>
  )
}
