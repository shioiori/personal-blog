'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type FocusEvent, type MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { DateSelectArg, DatesSetArg, EventChangeArg } from '@fullcalendar/core'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { PlannerTask } from '@/src/declaration/planner'
import { colorForTask } from '@/src/components/planner/colors'
import { SegmentText } from '@/src/components/planner/SegmentText'
import { ColumnResizeHandles, EQUAL_COLUMN_WIDTHS, columnWidthVars } from '@/src/components/planner/ColumnResizeHandles'
import { useAuth } from '@/src/context/auth'

const DRAFT_ID = 'draft'

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return toDateStr(date)
}

export default function PlannerPage() {
  const t = useTranslations('Planner')
  const { user, loading: authLoading } = useAuth()
  const [tasks, setTasks] = useState<PlannerTask[]>([])
  const [draft, setDraft] = useState<{ date: string; endDate: string | null } | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const rangeRef = useRef<{ from: string; to: string } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [columnWidths, setColumnWidths] = useState<number[]>(EQUAL_COLUMN_WIDTHS)
  const [segmentEnds, setSegmentEnds] = useState<Record<string, Record<string, number>>>({})

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

  function handleDatesSet(arg: DatesSetArg) {
    rangeRef.current = { from: toDateStr(arg.start), to: toDateStr(arg.end) }
    refetch()
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
    })
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
      const res = await request('/api/planner/tasks', 'POST', { ...current, text })
      if (res.ok) {
        const created = (await res.json()) as PlannerTask
        setTasks((prev) => [...prev, created])
      }
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
      checked: task.checked
    }))
    if (draft) items.push({ id: DRAFT_ID, title: '', start: draft.date, endDate: draft.endDate, checked: false })
    return items.map(({ endDate, checked, ...item }) => {
      const color = colorForTask(item.id)
      return {
        ...item,
        end: endDate ? addDays(endDate, 1) : undefined,
        allDay: true,
        editable: item.id !== DRAFT_ID && item.id !== String(editingId),
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        extendedProps: { checked, color }
      }
    })
  }, [tasks, draft, editingId])

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl p-6">
        <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>

        {!authLoading && !user && (
          <p className="text-sm text-muted-foreground mb-4">{t('loginRequired')}</p>
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
                const isDraft = info.event.id === DRAFT_ID
                const taskId = isDraft ? null : Number(info.event.id)
                const editing = (isDraft || taskId === editingId) && info.isStart
                const segmentKey = `${info.event.id}|${info.event.startStr}|${info.event.endStr}|${info.event.title}`
                return (
                  <div className={`group flex items-center gap-1 w-full overflow-hidden cursor-pointer active:cursor-grabbing ${info.isStart ? 'pl-0.5' : ''}`}>
                    {info.isStart && (
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={taskId === null}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => taskId !== null && handleToggle(taskId, !checked)}
                        className="shrink-0 cursor-pointer"
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
                      className={`flex min-w-0 flex-1 items-center gap-1 px-1.5 py-px ${info.isStart ? 'rounded-l-md' : ''} ${info.isEnd ? 'rounded-r-md' : ''}`}
                      style={{ backgroundColor: `${color.bar}4D` }}
                    >
                      {editing ? (
                        <input
                          data-planner-input
                          autoFocus
                          defaultValue={info.event.title}
                          placeholder={t('taskPlaceholder')}
                          onBlur={(e) => handleCommit(e, taskId)}
                          onKeyDown={handleInputKeyDown}
                          className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                          style={{ color: color.text }}
                        />
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
                              setDraft(null)
                              setEditingId(taskId)
                            }}
                          />
                          {taskId !== null && (
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
