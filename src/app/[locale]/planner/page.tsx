'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type FocusEvent, type MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { DateSelectArg, DatesSetArg, EventChangeArg } from '@fullcalendar/core'
import { CalendarDays, Plus, Sprout, WrapText, X } from 'lucide-react'
import { toast } from 'sonner'
import { PlannerCategory, PlannerTask } from '@/src/declaration/planner'
import { GardenTab } from '@/src/components/planner/GardenTab'
import { CATEGORY_COLORS, colorForTask } from '@/src/components/planner/colors'
import { SegmentText } from '@/src/components/planner/SegmentText'
import { ColumnResizeHandles, EQUAL_COLUMN_WIDTHS, columnWidthVars } from '@/src/components/planner/ColumnResizeHandles'
import { useAuth } from '@/src/context/auth'
import { Button } from '@/src/components/ui/Button'
import { Textarea } from '@/src/components/ui/Textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/Tabs'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/Dialog'
import { formatTasks } from '@/src/lib/planner-text'

const DRAFT_ID = 'draft'

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
  const [categories, setCategories] = useState<PlannerCategory[]>([])
  const [newCategoryOpen, setNewCategoryOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0])
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('planner-text-mode')
    if (stored === 'wrap' || stored === 'truncate') setTextMode(stored)
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
    if (!draft && editingId === null) return
    function handlePointerDown(e: PointerEvent) {
      const input = document.querySelector<HTMLInputElement>('[data-planner-input]')
      if (input && !input.contains(e.target as Node)) input.blur()
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [draft, editingId])

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
    return formatTasks(tasks.filter((x) => x.date <= month.to && (x.endDate ?? x.date) >= month.from))
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

  async function handleToggle(taskId: number, checked: boolean) {
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, checked } : x)))
    const res = await request(`/api/planner/tasks/${taskId}`, 'PUT', { checked })
    if (!res.ok) setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, checked: !checked } : x)))
  }

  async function handleEventChange(arg: EventChangeArg) {
    const taskId = Number(arg.event.id)
    const date = arg.event.startStr
    const lastDay = arg.event.endStr ? addDays(arg.event.endStr, -1) : date
    const endDate = lastDay > date ? lastDay : null
    const res = await request(`/api/planner/tasks/${taskId}`, 'PUT', { date, endDate })
    if (!res.ok) return arg.revert()
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, date, endDate } : x)))
  }

  async function handleDelete(taskId: number) {
    const res = await request(`/api/planner/tasks/${taskId}`, 'DELETE')
    if (res.ok) setTasks((prev) => prev.filter((x) => x.id !== taskId))
  }

  async function handleCommit(e: FocusEvent<HTMLInputElement>, taskId: number | null) {
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
      setTasks((prev) => [...prev, { id: tempId, ...current, text, checked: false, categoryId: null }])
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

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') e.currentTarget.dataset.cancel = '1'
    if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
  }

  const events = useMemo(() => {
    const items = tasks.map((task) => ({
      id: String(task.id),
      title: task.text,
      start: task.date,
      endDate: task.endDate,
      checked: task.checked,
      categoryId: task.categoryId
    }))
    if (draft) items.push({ id: DRAFT_ID, title: '', start: draft.date, endDate: draft.endDate, checked: false, categoryId: null })
    return items.map(({ endDate, checked, categoryId, ...item }) => {
      const pending = Number(item.id) < 0
      const color = colorForTask(pending ? DRAFT_ID : item.id)
      return {
        ...item,
        end: endDate ? addDays(endDate, 1) : undefined,
        allDay: true,
        editable: !pending && item.id !== DRAFT_ID && item.id !== String(editingId),
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        extendedProps: { checked, color, categoryId }
      }
    })
  }, [tasks, draft, editingId])

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
              select={handleSelect}
              eventChange={handleEventChange}
              eventDragStart={() => gridRef.current?.classList.add('planner-dragging')}
              eventDragStop={() => gridRef.current?.classList.remove('planner-dragging')}
              datesSet={handleDatesSet}
              eventContent={(info) => {
                const checked = info.event.extendedProps.checked as boolean
                const color = info.event.extendedProps.color as ReturnType<typeof colorForTask>
                const categoryId = info.event.extendedProps.categoryId as number | null
                const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined
                const isDraft = info.event.id === DRAFT_ID
                const taskId = isDraft ? null : Number(info.event.id)
                const pending = taskId !== null && taskId < 0
                const readOnly = taskId === null || pending
                const editing = (isDraft || taskId === editingId) && info.isStart
                const segmentKey = `${info.event.id}|${info.event.startStr}|${info.event.endStr}|${info.event.title}`
                const wrap = textMode === 'wrap'
                return (
                  <div
                    className={`group flex items-center gap-1 w-full cursor-pointer active:cursor-grabbing ${info.isStart ? 'pl-0.5' : ''} ${pending ? 'opacity-60' : ''} ${wrap ? 'items-start' : ''} ${wrap ? '' : 'overflow-hidden'}`}
                  >
                    {info.isStart && (
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={readOnly}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => !readOnly && handleToggle(taskId, !checked)}
                        className={`shrink-0 cursor-pointer ${wrap ? 'mt-1' : ''}`}
                        style={{
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          appearance: 'none',
                          height: 12,
                          width: 12,
                          borderRadius: 9999,
                          border: `2px solid ${color.bar}`,
                          backgroundColor: checked ? `${color.bar}B3` : 'transparent',
                          margin: 0
                        }}
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
                        if (readOnly || !e.dataTransfer.types.includes('text/planner-category-id')) return
                        e.preventDefault()
                        setDragOverTaskId(taskId)
                      }}
                      onDragLeave={() => setDragOverTaskId((prev) => (prev === taskId ? null : prev))}
                      onDrop={(e) => {
                        setDragOverTaskId(null)
                        if (readOnly) return
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
                      {editing ? (
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
                            className={`min-w-0 flex-1 text-xs font-medium ${checked ? 'line-through opacity-70' : ''}`}
                            style={{ color: color.text, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            onClick={() => {
                              if (readOnly) return
                              setDraft(null)
                              setEditingId(taskId)
                            }}
                          >
                            {info.isStart ? info.event.title || ' ' : ' '}
                          </span>
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
                            className={`min-w-0 flex-1 truncate text-xs font-medium ${checked ? 'line-through opacity-70' : ''}`}
                            style={{ color: color.text }}
                            onClick={() => {
                              if (readOnly) return
                              setDraft(null)
                              setEditingId(taskId)
                            }}
                          />
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
