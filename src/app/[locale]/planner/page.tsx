'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type FocusEvent, type MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { EventDragStartArg, EventDragStopArg } from '@fullcalendar/interaction'
import { DateSelectArg, DatesSetArg, EventChangeArg, EventContentArg } from '@fullcalendar/core'
import { CalendarDays, Maximize2, MessageSquareText, Minimize2, Plus, Sprout, WrapText, X } from 'lucide-react'
import { toast } from 'sonner'
import { PlannerCategory, PlannerStatus, PlannerTask } from '@/src/declaration/planner'
import { GardenTab } from '@/src/components/planner/GardenTab'
import { CATEGORY_COLORS, colorForTask } from '@/src/components/planner/colors'
import { DRAFT_ID, SUBTASK_DRAFT_PREFIX, TaskPill, statusCheckboxStyle, type PillActions } from '@/src/components/planner/TaskPill'
import { ColumnResizeHandles, EQUAL_COLUMN_WIDTHS, columnWidthVars } from '@/src/components/planner/ColumnResizeHandles'
import { SubtaskSlot, dayCellAt } from '@/src/components/planner/SubtaskSlot'
import { useAuth } from '@/src/context/auth'
import { Button } from '@/src/components/ui/Button'
import { Textarea } from '@/src/components/ui/Textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/Tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/Tooltip'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/Dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/src/components/ui/DropdownMenu'
import { deriveStatus, formatTasks } from '@/src/lib/planner-text'
import { addDays, dayDiff, fitChildRange, isWithin, rangeEnd, shiftRange, type DateRange } from '@/src/lib/planner-range'

const STATUSES: PlannerStatus[] = ['undone', 'partial', 'done']
const PLUGINS = [dayGridPlugin, interactionPlugin]
const HEADER_TOOLBAR = { left: 'prev,next today', center: 'title', right: '' }
const NO_CHILDREN: PlannerTask[] = []

function byEventOrder(a: unknown, b: unknown) {
  return (a as { extendedProps: { order: number } }).extendedProps.order - (b as { extendedProps: { order: number } }).extendedProps.order
}

type EditableFields = Partial<Pick<PlannerTask, 'text' | 'date' | 'endDate' | 'notes'>>

function DateRangeFields({
  start,
  end,
  bounds,
  invalid,
  onChange
}: {
  start: string
  end: string
  bounds?: DateRange
  invalid: boolean
  onChange: (start: string, end: string) => void
}) {
  const inputProps = {
    type: 'date',
    min: bounds?.date,
    max: bounds && rangeEnd(bounds),
    'aria-invalid': invalid,
    className: `rounded-md border bg-background px-2 py-1 text-sm outline-none ${invalid ? 'border-destructive text-destructive' : ''}`
  }

  return (
    <div className="flex items-center gap-2">
      <input {...inputProps} value={start} onChange={(e) => onChange(e.target.value, end)} />
      <span className="text-muted-foreground">–</span>
      <input {...inputProps} value={end} onChange={(e) => onChange(start, e.target.value)} />
    </div>
  )
}

function monthRange(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${new Date(y, date.getMonth() + 1, 0).getDate()}` }
}

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10)
}

function byOrder(a: PlannerTask, b: PlannerTask) {
  return a.position - b.position || a.date.localeCompare(b.date) || a.id - b.id
}

function rowsAtColumn(row: Element, x: number) {
  return [...row.querySelectorAll<HTMLElement>('[data-task-id]')]
    .filter((el) => !el.closest('.fc-event-mirror'))
    .map((el) => {
      const rect = el.getBoundingClientRect()
      return { id: Number(el.dataset.taskId), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, midY: rect.top + rect.height / 2 }
    })
    .filter((r) => r.left <= x && x <= r.right)
    .sort((a, b) => a.midY - b.midY)
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
  const [dragging, setDragging] = useState(false)
  const [contextTaskId, setContextTaskId] = useState<number | null>(null)
  const [peekMode, setPeekMode] = useState(false)
  const [pageEdits, setPageEdits] = useState<{ taskId: number; text?: string; start?: string; end?: string; notes?: string } | null>(null)
  const [contextDate, setContextDate] = useState<string | null>(null)
  const [subtaskDraftParentId, setSubtaskDraftParentId] = useState<number | null>(null)
  const [copied, setCopied] = useState<(Pick<PlannerTask, 'text' | 'categoryId' | 'notes'> & { days: number }) | null>(null)
  const [dayMenu, setDayMenu] = useState<{ date: string; x: number; y: number } | null>(null)
  const reparentedRef = useRef<number | null>(null)
  const stopDragTrackingRef = useRef<(() => void) | null>(null)
  const grabDateRef = useRef<string | null>(null)
  const actionsRef = useRef<PillActions | null>(null)
  const [hoverTip, setHoverTip] = useState<{ id: number; rect: DOMRect } | null>(null)
  const [groupFrames, setGroupFrames] = useState<{ left: number; top: number; width: number; height: number }[]>([])

  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const taskById = useMemo(() => new Map(tasks.map((x) => [x.id, x])), [tasks])
  const childrenByParent = useMemo(() => {
    const map = new Map<number, PlannerTask[]>()
    for (const x of [...tasks].sort(byOrder)) {
      if (x.parentId === null) continue
      const list = map.get(x.parentId)
      if (list) list.push(x)
      else map.set(x.parentId, [x])
    }
    return map
  }, [tasks])

  function statusOf(task: PlannerTask) {
    const children = childrenByParent.get(task.id)
    return children?.length ? deriveStatus(children) : task.status
  }

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

  function handleAssignCategory(taskId: number, categoryId: number | null) {
    mutateTasks(
      (list) => list.map((x) => (x.id === taskId ? { ...x, categoryId } : x)),
      () => isOk(request(`/api/planner/tasks/${taskId}`, 'PUT', { categoryId }))
    )
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
        .map((x) => ({ ...x, status: statusOf(x), subtasks: childrenByParent.get(x.id) ?? NO_CHILDREN }))
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
    setDayMenu({ date, x: e.clientX, y: e.clientY })
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

  function isOk(res: Promise<Response>) {
    return res.then((r) => r.ok)
  }

  async function mutateTasks(update: (list: PlannerTask[]) => PlannerTask[], send: () => Promise<boolean>) {
    const current = tasksRef.current
    const before = new Map(current.map((x) => [x.id, x]))
    const next = update(current)
    const nextIds = new Set(next.map((x) => x.id))
    const touched = new Set([
      ...next.filter((x) => before.get(x.id) !== x).map((x) => x.id),
      ...current.filter((x) => !nextIds.has(x.id)).map((x) => x.id)
    ])
    setTasks((prev) => update(prev))
    const ok = await send()
    if (!ok) {
      setTasks((prev) => [...prev.filter((x) => !touched.has(x.id)), ...[...touched].flatMap((id) => before.get(id) ?? [])])
    }
    return ok
  }

  function handleSetStatus(taskId: number, status: PlannerStatus) {
    mutateTasks(
      (list) => list.map((x) => (x.id === taskId ? { ...x, status } : x)),
      () => isOk(request(`/api/planner/tasks/${taskId}`, 'PUT', { status }))
    )
  }

  // Plain click only ever flips between done/undone; "partial" is only reachable from the modal.
  function handleToggle(task: PlannerTask) {
    handleSetStatus(task.id, task.status === 'done' ? 'undone' : 'done')
  }

  // Clicking a task that has subtasks toggles all of them together instead of its own (derived) status.
  function handleToggleGroup(children: PlannerTask[]) {
    if (!children.length) return
    const next: PlannerStatus = children.every((c) => c.status === 'done') ? 'undone' : 'done'
    const ids = new Set(children.map((c) => c.id))
    mutateTasks(
      (list) => list.map((x) => (ids.has(x.id) ? { ...x, status: next } : x)),
      async () => {
        let ok = true
        for (const c of children) ok = (await isOk(request(`/api/planner/tasks/${c.id}`, 'PUT', { status: next }))) && ok
        return ok
      }
    )
  }

  function handleUpdateTask(taskId: number, fields: EditableFields) {
    const before = taskById.get(taskId)
    if (!before) return
    const after = { ...before, ...fields }
    const moved = after.date !== before.date || after.endDate !== before.endDate
    mutateTasks(
      (list) =>
        list.map((x) =>
          x.id === taskId ? { ...x, ...fields } : moved && x.parentId === taskId ? { ...x, ...fitChildRange(x, before, after) } : x
        ),
      () => isOk(request(`/api/planner/tasks/${taskId}`, 'PUT', fields))
    )
  }

  async function createTaskOptimistic(fields: Pick<PlannerTask, 'date' | 'endDate' | 'text' | 'categoryId' | 'parentId' | 'notes'>) {
    const tempId = -Date.now()
    setTasks((prev) => [...prev, { id: tempId, ...fields, status: 'undone', position: Number.MAX_SAFE_INTEGER }])
    const res = await request('/api/planner/tasks', 'POST', fields)
    if (!res.ok) return setTasks((prev) => prev.filter((x) => x.id !== tempId))
    const created = (await res.json()) as PlannerTask
    setTasks((prev) => [...prev.filter((x) => x.id !== tempId && x.id !== created.id), created])
  }

  function handleCreateSubtask(parentId: number, rawText: string) {
    const text = rawText.trim()
    const parent = tasks.find((x) => x.id === parentId)
    if (text && parent) createTaskOptimistic({ date: parent.date, endDate: parent.endDate, text, categoryId: null, parentId, notes: '' })
  }

  function handleCopy(task: PlannerTask) {
    setCopied({ text: task.text, categoryId: task.categoryId, notes: task.notes, days: dayDiff(task.date, rangeEnd(task)) })
    toast.success(t('copied'))
  }

  function handlePaste(date: string) {
    if (!copied) return
    const { days, ...fields } = copied
    createTaskOptimistic({ ...fields, date, endDate: days ? addDays(date, days) : null, parentId: null })
  }

  async function handleSetParent(task: PlannerTask, parent: PlannerTask | null, range: DateRange, order: number[]) {
    const parentId = parent?.id ?? null
    reparentedRef.current = task.id
    const ok = await mutateTasks(
      (list) => list.map((x) => (x.id === task.id ? { ...x, ...range, parentId, categoryId: parent ? null : x.categoryId } : x)),
      () => isOk(request(`/api/planner/tasks/${task.id}`, 'PUT', { parentId, ...range }))
    )
    if (ok) handleReorder(order)
  }

  function nestTargetAt(x: number, y: number, task: PlannerTask) {
    if (tasks.some((t) => t.parentId === task.id)) return null
    for (const el of document.elementsFromPoint(x, y)) {
      const pill = el.closest<HTMLElement>('[data-task-id]')
      if (!pill || pill.closest('.fc-event-mirror')) continue
      const target = tasks.find((t) => t.id === Number(pill.dataset.taskId))
      const rect = pill.getBoundingClientRect()
      const inMiddle = Math.abs(y - (rect.top + rect.height / 2)) <= rect.height / 4
      return target && inMiddle && target.id > 0 && target.parentId === null && target.id !== task.id && target.id !== task.parentId
        ? target
        : null
    }
    return null
  }

  function handleEventChange(arg: EventChangeArg) {
    const id = Number(arg.event.id)
    const task = taskById.get(id)
    const parent = task?.parentId ? taskById.get(task.parentId) : undefined
    const date = arg.event.startStr
    const lastDay = arg.event.endStr ? addDays(arg.event.endStr, -1) : date
    const range =
      task && parent ? shiftRange(task, dayDiff(arg.oldEvent.startStr, date)) : { date, endDate: lastDay > date ? lastDay : null }
    if (reparentedRef.current === id || (parent && !isWithin(range, parent))) return arg.revert()
    handleUpdateTask(id, range)
  }

  function handleReorder(ids: number[]) {
    const positions = new Map(ids.map((id, i) => [id, i + 1]))
    mutateTasks(
      (list) =>
        list.map((x) => {
          const position = positions.get(x.id)
          return position === undefined || position === x.position ? x : { ...x, position }
        }),
      () => isOk(request('/api/planner/tasks/reorder', 'PUT', { ids }))
    )
  }

  function handleEventDragStart(arg: EventDragStartArg) {
    setDragging(true)
    reparentedRef.current = null
    grabDateRef.current = dayCellAt(arg.jsEvent.clientX, arg.jsEvent.clientY)?.dataset.date ?? null
    const task = tasks.find((t) => t.id === Number(arg.event.id))
    if (!task) return
    const handleMove = (e: PointerEvent) => setDragOverTaskId(nestTargetAt(e.clientX, e.clientY, task)?.id ?? null)
    document.addEventListener('pointermove', handleMove)
    stopDragTrackingRef.current = () => document.removeEventListener('pointermove', handleMove)
  }

  function handleEventDragStop(arg: EventDragStopArg) {
    setDragging(false)
    stopDragTrackingRef.current?.()
    setDragOverTaskId(null)
    const { clientX: x, clientY: y } = arg.jsEvent
    const task = tasks.find((t) => t.id === Number(arg.event.id))
    if (!task) return
    const childrenOf = (parentId: number | null) => tasks.filter((t) => t.parentId === parentId && t.id > 0).sort(byOrder)
    const target = nestTargetAt(x, y, task)
    if (target) {
      const range = { date: target.date, endDate: target.endDate }
      return handleSetParent(task, target, range, [...childrenOf(target.id), task].map((t) => t.id))
    }
    const cell = dayCellAt(x, y)
    const row = cell?.closest('tr')
    if (!cell?.dataset.date || !row) return
    const parent = tasks.find((t) => t.id === task.parentId)
    const delta = grabDateRef.current ? dayDiff(grabDateRef.current, cell.dataset.date) : 0
    const moved = shiftRange(task, delta)
    const columnRows = rowsAtColumn(row, x)
    const group = columnRows.filter((r) => r.id === task.parentId || childrenOf(task.parentId).some((t) => t.id === r.id))
    const insideGroup = group.length > 0 && y >= group[0].top && y <= group[group.length - 1].bottom
    const leaving = !!parent && (delta ? !isWithin(moved, parent) : !insideGroup)
    if (parent && delta && !leaving) return
    const current = childrenOf(leaving ? null : task.parentId)
    const others = current.filter((t) => t.id !== task.id)
    const visible = columnRows.filter((r) => others.some((t) => t.id === r.id))
    const index = visible.filter((r) => r.midY < y).length
    const anchor = visible[index] ?? visible[index - 1]
    const at = anchor ? others.findIndex((t) => t.id === anchor.id) + (visible[index] ? 0 : 1) : others.length
    const ordered = [...others.slice(0, at), task, ...others.slice(at)].map((t) => t.id)
    if (leaving) return handleSetParent(task, null, moved, ordered)
    if (!anchor || ordered.every((id, i) => id === current[i].id)) return
    handleReorder(ordered)
  }

  async function handleDelete(taskId: number) {
    const isSubtask = !!taskById.get(taskId)?.parentId
    const ok = await mutateTasks(
      (list) => list.filter((x) => x.id !== taskId && x.parentId !== taskId),
      () => isOk(request(`/api/planner/tasks/${taskId}`, 'DELETE'))
    )
    if (ok && isSubtask) refetch()
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
      if (text && current) createTaskOptimistic({ ...current, text, categoryId: null, parentId: null, notes: '' })
      return
    }
    if (!text) return handleDelete(taskId)
    if (text !== taskById.get(taskId)?.text) handleUpdateTask(taskId, { text })
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
    const children = childrenByParent.get(task.id) ?? NO_CHILDREN
    const hasChildren = children.length > 0
    const status = statusOf(task)
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
            onClick={() => {
              setPageEdits(null)
              setContextTaskId(task.id)
            }}
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
              if (text && text !== task.text) handleUpdateTask(task.id, { text })
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
        {(childrenByParent.get(task.id) ?? NO_CHILDREN).map((child) => renderTaskRow(child, true, asLink))}
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

  function closeTaskModal() {
    ;(document.activeElement as HTMLElement | null)?.blur()
    setContextTaskId(null)
    setSubtaskDraftParentId(null)
    setPeekMode(false)
    setPageEdits(null)
  }

  function renderTaskPage(task: PlannerTask) {
    const status = statusOf(task)
    const hasChildren = tasks.some((x) => x.parentId === task.id)
    const isTopLevel = task.parentId === null
    const parent = task.parentId !== null ? taskById.get(task.parentId) : undefined
    const edits = pageEdits?.taskId === task.id ? pageEdits : null
    const form = {
      text: edits?.text ?? task.text,
      start: edits?.start ?? task.date,
      end: edits?.end ?? rangeEnd(task),
      notes: edits?.notes ?? task.notes
    }
    const datesInvalid =
      !form.start || !form.end || form.start > form.end || (!!parent && !isWithin({ date: form.start, endDate: form.end }, parent))
    const changes: EditableFields = {}
    if (form.text.trim() && form.text.trim() !== task.text) changes.text = form.text.trim()
    if (form.start !== task.date || form.end !== rangeEnd(task)) {
      changes.date = form.start
      changes.endDate = form.end > form.start ? form.end : null
    }
    if (form.notes !== task.notes) changes.notes = form.notes
    const canSave = Object.keys(changes).length > 0 && !datesInvalid
    const edit = (patch: Omit<NonNullable<typeof pageEdits>, 'taskId'>) =>
      setPageEdits((prev) => ({ ...(prev?.taskId === task.id ? prev : {}), ...patch, taskId: task.id }))
    const save = () => {
      if (!canSave) return
      handleUpdateTask(task.id, changes)
      closeTaskModal()
    }
    return (
      <>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-10 pb-10 pt-12">
        <button
          type="button"
          title={t('viewCompact')}
          aria-label={t('viewCompact')}
          onClick={() => {
            setPageEdits(null)
            setPeekMode(false)
          }}
          className="absolute right-12 top-4 rounded-sm opacity-70 hover:opacity-100"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
        <DialogTitle className="sr-only">{t('taskDetails')}</DialogTitle>
        <input
          value={form.text}
          onChange={(e) => edit({ text: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          className={`w-full bg-transparent text-3xl font-bold outline-none ${status === 'done' ? 'line-through opacity-70' : ''}`}
        />
        <div className="grid grid-cols-[8rem_1fr] items-center gap-x-4 gap-y-3 text-sm">
          <span className="text-muted-foreground">{t('dates')}</span>
          <DateRangeFields
            start={form.start}
            end={form.end}
            bounds={parent}
            invalid={datesInvalid}
            onChange={(start, end) => edit({ start, end })}
          />
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
          value={form.notes}
          placeholder={t('notesPlaceholder')}
          onChange={(e) => edit({ notes: e.target.value })}
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
      <div className="flex justify-end border-t px-10 py-3">
        <Button size="sm" disabled={!canSave} onClick={save}>
          {t('save')}
        </Button>
      </div>
      </>
    )
  }

  const events = useMemo(() => {
    const items: { id: string; title: string; start: string; end?: string; classNames?: string[] }[] = []
    const span = (x: DateRange) => ({ start: x.date, end: x.endDate ? addDays(x.endDate, 1) : undefined })
    for (const task of tasks.filter((t) => t.parentId === null).sort(byOrder)) {
      const groupSpan = span(task)
      items.push(
        { id: String(task.id), title: task.text, ...groupSpan },
        ...(childrenByParent.get(task.id) ?? NO_CHILDREN).map((c) => ({
          id: String(c.id),
          title: c.text,
          ...groupSpan,
          classNames: ['planner-subtask-event']
        }))
      )
      if (subtaskDraftParentId === task.id) items.push({ id: `${SUBTASK_DRAFT_PREFIX}${task.id}`, title: '', ...groupSpan })
    }
    if (draft) items.push({ id: DRAFT_ID, title: '', ...span(draft) })
    return items.map((item, order) => {
      const task = taskById.get(Number(item.id))
      const pending = !!task && task.id < 0
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
  }, [tasks, taskById, childrenByParent, draft, editingId, subtaskDraftParentId])

  actionsRef.current = {
    copy: handleCopy,
    addSubtask: setSubtaskDraftParentId,
    remove: handleDelete,
    resize: (task, days) => handleUpdateTask(task.id, { date: task.date, endDate: days ? addDays(task.date, days) : null }),
    open: setContextTaskId,
    toggle: (task) => {
      const children = childrenByParent.get(task.id)
      if (children?.length) handleToggleGroup(children)
      else handleToggle(task)
    },
    assignCategory: handleAssignCategory,
    setDragOver: setDragOverTaskId,
    startEdit: (taskId) => {
      setDraft(null)
      setEditingId(taskId)
    },
    commit: handleCommit,
    commitSubtaskDraft: handleSubtaskDraftCommit,
    inputKeyDown: handleInputKeyDown
  }

  const calendarHandlersRef = useRef({ handleSelect, handleEventChange, handleEventDragStart, handleEventDragStop, handleDatesSet })
  calendarHandlersRef.current = { handleSelect, handleEventChange, handleEventDragStart, handleEventDragStop, handleDatesSet }
  const calendarHandlers = useMemo(
    () => ({
      select: (arg: DateSelectArg) => calendarHandlersRef.current.handleSelect(arg),
      eventChange: (arg: EventChangeArg) => calendarHandlersRef.current.handleEventChange(arg),
      eventDragStart: (arg: EventDragStartArg) => calendarHandlersRef.current.handleEventDragStart(arg),
      eventDragStop: (arg: EventDragStopArg) => calendarHandlersRef.current.handleEventDragStop(arg),
      datesSet: (arg: DatesSetArg) => calendarHandlersRef.current.handleDatesSet(arg)
    }),
    []
  )

  const renderEvent = useCallback(
    (info: EventContentArg) => {
      const id = info.event.id
      const isDraft = id === DRAFT_ID
      const task = taskById.get(Number(id))
      const children = task && task.parentId === null ? childrenByParent.get(task.id) : undefined
      const segmentKey = `${id}|${info.event.startStr}|${info.event.endStr}|${info.event.title}`
      const parent = task?.parentId ? taskById.get(task.parentId) : undefined
      const pill = (isStart: boolean, isEnd: boolean) => (
        <TaskPill
          eventId={id}
          title={info.event.title}
          isStart={isStart}
          isEnd={isEnd}
          segmentKey={segmentKey}
          task={task}
          status={task ? (children?.length ? deriveStatus(children) : task.status) : 'undone'}
          category={task?.categoryId ? categories.find((c) => c.id === task.categoryId) : undefined}
          editing={(isDraft || (!!task && task.id === editingId)) && isStart}
          wrap={textMode === 'wrap'}
          highlighted={!!task && task.id === dragOverTaskId}
          segmentEnds={segmentEnds[segmentKey]}
          onMeasure={handleSegmentMeasure}
          actions={actionsRef}
        />
      )
      if (!task || !parent) return pill(info.isStart, info.isEnd)
      return (
        <SubtaskSlot
          spanStart={info.event.startStr}
          offset={dayDiff(parent.date, task.date)}
          length={dayDiff(task.date, rangeEnd(task))}
          maxLength={dayDiff(task.date, rangeEnd(parent))}
          resizable={task.id > 0}
          onResize={(days) => actionsRef.current?.resize(task, days)}
        >
          {({ isStart, isEnd }) => pill(isStart, isEnd)}
        </SubtaskSlot>
      )
    },
    [taskById, childrenByParent, categories, editingId, textMode, dragOverTaskId, segmentEnds, handleSegmentMeasure]
  )

  const calendar = useMemo(
    () => (
      <FullCalendar
        plugins={PLUGINS}
        initialView="dayGridMonth"
        headerToolbar={HEADER_TOOLBAR}
        height="auto"
        selectable
        editable
        eventOrder={byEventOrder}
        {...calendarHandlers}
        eventContent={renderEvent}
        events={events}
      />
    ),
    [calendarHandlers, renderEvent, events]
  )

  useEffect(() => {
    if (!hoverTip) return
    const hide = () => setHoverTip(null)
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [hoverTip])

  function handleGridMouseOver(e: MouseEvent<HTMLDivElement>) {
    const pill = (e.target as HTMLElement).closest<HTMLElement>('[data-task-id]')
    const id = pill?.dataset.taskId && !pill.closest('.fc-event-mirror') ? Number(pill.dataset.taskId) : null
    setHoverTip((prev) => (prev?.id === id ? prev : id === null ? null : { id, rect: (pill as HTMLElement).getBoundingClientRect() }))
  }

  const hoverTask =
    hoverTip && !dragging && hoverTip.id !== editingId && contextTaskId === null && contextDate === null && !dayMenu
      ? taskById.get(hoverTip.id)
      : undefined
  const tipTask = showTooltip ? hoverTask : undefined
  const hoverGroupId = hoverTask ? hoverTask.parentId ?? hoverTask.id : null
  const frameGroupId = hoverGroupId !== null && childrenByParent.get(hoverGroupId)?.length ? hoverGroupId : null

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (frameGroupId === null || !grid) return setGroupFrames([])
    const ids = new Set([frameGroupId, ...(childrenByParent.get(frameGroupId) ?? NO_CHILDREN).map((c) => c.id)].map(String))
    function measure() {
      const box = (grid as HTMLDivElement).getBoundingClientRect()
      const rows = new Map<Element, DOMRect[]>()
      ;(grid as HTMLDivElement).querySelectorAll<HTMLElement>('[data-task-id]').forEach((el) => {
        const row = el.closest('tr')
        if (!row || !ids.has(el.dataset.taskId ?? '') || el.closest('.fc-event-mirror')) return
        rows.set(row, [...(rows.get(row) ?? []), el.getBoundingClientRect()])
      })
      setGroupFrames(
        [...rows.values()].map((rects) => {
          const left = Math.min(...rects.map((r) => r.left))
          const top = Math.min(...rects.map((r) => r.top))
          return {
            left: left - box.left - 2,
            top: top - box.top - 2,
            width: Math.max(...rects.map((r) => r.right)) - left + 4,
            height: Math.max(...rects.map((r) => r.bottom)) - top + 4
          }
        })
      )
    }
    measure()
    const frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [frameGroupId, childrenByParent, columnWidths, textMode])

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
            if (!open) closeTaskModal()
          }}
        >
          {(() => {
            const contextTask = contextTaskId !== null ? taskById.get(contextTaskId) : undefined
            return (
              <DialogContent aria-describedby={undefined} className={peekMode ? 'h-[85dvh] max-w-3xl gap-0 p-0' : 'max-w-md'}>
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
                        className="rounded-sm text-muted-foreground hover:text-foreground"
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
            ;(document.activeElement as HTMLElement | null)?.blur()
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

        <DropdownMenu modal={false} open={dayMenu !== null} onOpenChange={(open) => !open && setDayMenu(null)}>
          <DropdownMenuTrigger asChild>
            <span className="pointer-events-none fixed h-0 w-0" style={{ left: dayMenu?.x, top: dayMenu?.y }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => dayMenu && setContextDate(dayMenu.date)}>{t('openDay')}</DropdownMenuItem>
            <DropdownMenuItem disabled={!copied} onSelect={() => dayMenu && handlePaste(dayMenu.date)}>
              {t('paste')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
            className={`relative min-w-[640px] ${dragging ? 'planner-dragging' : ''}`}
            style={columnWidthVars(columnWidths)}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleDayContextMenu}
            onMouseOver={handleGridMouseOver}
            onMouseLeave={() => setHoverTip(null)}
          >
            {calendar}
            <ColumnResizeHandles containerRef={gridRef} widths={columnWidths} onChange={setColumnWidths} />
            {frameGroupId !== null &&
              groupFrames.map((frame, i) => (
                <div
                  key={i}
                  className="pointer-events-none absolute z-[5] rounded-lg"
                  style={{ ...frame, border: `1.5px solid ${colorForTask(frameGroupId).bar}` }}
                />
              ))}
            {tipTask && hoverTip && (
              <Tooltip key={hoverTip.id} open>
                <TooltipTrigger asChild>
                  <span
                    className="pointer-events-none fixed"
                    style={{ left: hoverTip.rect.left, top: hoverTip.rect.top, width: hoverTip.rect.width, height: hoverTip.rect.height }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs whitespace-normal break-words">
                  {tipTask.text}
                </TooltipContent>
              </Tooltip>
            )}
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
        .planner-calendar .fc-daygrid-bg-harness,
        .planner-calendar .planner-subtask-event {
          pointer-events: none;
        }
        .planner-calendar .planner-subtask-event [data-subtask-visible] {
          pointer-events: auto;
        }
        .planner-dragging,
        .planner-dragging * {
          cursor: grabbing !important;
        }
      `}</style>
    </div>
  )
}
