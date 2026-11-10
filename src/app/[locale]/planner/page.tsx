'use client'

import { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { DatesSetArg } from '@fullcalendar/core'
import { toast } from 'sonner'
import { PlannerTask } from '@/src/declaration/planner'
import { TaskModal } from '@/src/components/planner/TaskModal'
import { colorForTask } from '@/src/components/planner/colors'
import { useAuth } from '@/src/context/auth'

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default function PlannerPage() {
  const t = useTranslations('Planner')
  const { user, loading: authLoading } = useAuth()
  const [tasks, setTasks] = useState<PlannerTask[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const rangeRef = useRef<{ from: string; to: string } | null>(null)

  const refetch = useCallback(async () => {
    if (!rangeRef.current) return
    const { from, to } = rangeRef.current
    const res = await fetch(`/api/planner/tasks?from=${from}&to=${to}`)
    if (res.ok) setTasks(await res.json())
  }, [])

  function handleDatesSet(arg: DatesSetArg) {
    rangeRef.current = { from: toDateStr(arg.start), to: toDateStr(arg.end) }
    refetch()
  }

  function handleDateClick(dateStr: string) {
    setSelectedDate(dateStr)
    setModalOpen(true)
  }

  async function handleToggle(taskId: number, checked: boolean) {
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, checked } : x)))
    const res = await fetch(`/api/planner/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked })
    })
    if (!res.ok) {
      setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, checked: !checked } : x)))
      toast.error(t('saveError'))
    }
  }

  const events = tasks.map((task) => {
    const color = colorForTask(task.id)
    return {
      id: String(task.id),
      title: task.text,
      start: task.date,
      allDay: true,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      extendedProps: { checked: task.checked, color }
    }
  })

  const tasksForSelectedDate = selectedDate ? tasks.filter((x) => x.date === selectedDate) : []

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>

        {!authLoading && !user && (
          <p className="text-sm text-muted-foreground mb-4">{t('loginRequired')}</p>
        )}

        <div className="w-full overflow-x-auto no-scrollbar planner-calendar">
          <div className="min-w-[640px]">
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
              dateClick={(e) => handleDateClick(e.dateStr)}
              datesSet={handleDatesSet}
              eventContent={(info) => {
                const checked = info.event.extendedProps.checked as boolean
                const color = info.event.extendedProps.color as ReturnType<typeof colorForTask>
                const taskId = Number(info.event.id)
                return (
                  <div className="flex items-center gap-1 pl-1 pr-1 w-full overflow-hidden">
                    <input
                      type="checkbox"
                      checked={checked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => handleToggle(taskId, !checked)}
                      className="shrink-0 cursor-pointer"
                      style={{
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        appearance: 'none',
                        height: 12,
                        width: 12,
                        borderRadius: 9999,
                        border: `2px solid ${color.bar}`,
                        backgroundColor: checked ? color.fillChecked : 'transparent',
                        margin: 0
                      }}
                    />
                    <span
                      className="block shrink-0 self-stretch rounded-full"
                      style={{ backgroundColor: color.bar, width: 3 }}
                    />
                    <span
                      className={`truncate text-xs font-medium ${checked ? 'line-through opacity-70' : ''}`}
                      style={{ color: color.text }}
                      onClick={() => handleDateClick(info.event.startStr)}
                    >
                      {info.event.title}
                    </span>
                  </div>
                )
              }}
              events={events}
            />
          </div>
        </div>
      </div>

      <TaskModal
        open={modalOpen}
        date={selectedDate}
        tasks={tasksForSelectedDate}
        onClose={() => setModalOpen(false)}
        onSaved={refetch}
      />

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
      `}</style>
    </div>
  )
}
