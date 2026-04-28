'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  DisciplineEvent,
  Income,
  IncomeDeclaration,
  IncomeType,
  TransactionType
} from '@/src/declaration/discipline'
import {
  getIncomes,
  getExpenses,
  updateIncome,
  updateExpense,
  deleteIncome,
  deleteExpense
} from '@/src/service/discipline'

export default function Calendar({
  settingKey,
  refreshTrigger,
  incomeDeclarations,
  onDateClick,
  onEventClick,
  onEventDelete
}: {
  settingKey: string
  refreshTrigger: number
  incomeDeclarations: IncomeDeclaration[]
  onDateClick: (date: Date) => void
  onEventClick: (recordId: number, type: TransactionType) => void
  onEventDelete: () => void
}) {
  const calendarRef = useRef(null)
  const [events, setEvents] = useState<DisciplineEvent[]>([])
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!settingKey) return
    startTransition(async () => {
      try {
        const [incomes, expenses] = await Promise.all([
          getIncomes(settingKey),
          getExpenses(settingKey)
        ])
        setEvents([
          ...incomes.map((x: Income) => {
            const decl = incomeDeclarations.find((d) => d.id === x.incomeDeclarationId)
            return {
              id: `income-${x.id}`,
              start: x.date,
              color: '#22c55e',
              extendedProps: {
                recordId: x.id!,
                type: TransactionType.Income,
                incomeDeclarationName: decl?.name,
                incomeDeclarationType: decl?.type,
                incomeDeclarationAmount: decl?.amount,
                quantity: x.quantity,
                checked: x.checked
              }
            }
          }),
          ...expenses.map((x) => ({
            id: `expense-${x.id}`,
            start: x.date,
            color: '#ef4444',
            extendedProps: {
              recordId: x.id,
              type: TransactionType.Expense,
              name: x.name,
              amount: x.amount
            }
          }))
        ])
      } catch {
        // not authenticated or no data
      }
    })
  }, [settingKey, refreshTrigger, incomeDeclarations])

  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[dayGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      selectable
      editable
      dateClick={(e) => onDateClick(new Date(e.dateStr))}
      eventClick={(info) => {
        const { recordId, type } = info.event.extendedProps as { recordId: number; type: TransactionType }
        onEventClick(recordId, type)
      }}
      eventContent={(info) => {
        const props = info.event.extendedProps as {
          recordId: number
          type: TransactionType
          incomeDeclarationName?: string
          incomeDeclarationType?: IncomeType
          incomeDeclarationAmount?: number
          quantity?: number
          checked?: boolean
          name?: string
          amount?: number
        }
        const color = info.event.backgroundColor

        let valuePart: string | null = null

        const isIncome = props.type === TransactionType.Income
        if (isIncome) {
          const amt = props.incomeDeclarationAmount
          if (props.incomeDeclarationType === IncomeType.Input && props.quantity != null) {
            valuePart = amt != null
              ? `${props.quantity} x ${amt.toLocaleString('vi-VN')}`
              : `x${props.quantity}`
          } else if (props.incomeDeclarationType === IncomeType.Checkbox && amt != null) {
            valuePart = amt.toLocaleString('vi-VN')
          }
        } else {
          if (props.amount != null) {
            valuePart = props.amount.toLocaleString('vi-VN')
          }
        }

        const name = isIncome ? (props.incomeDeclarationName ?? '') : (props.name ?? '')

        return (
          <div
            className="flex items-center gap-1 px-1 w-full overflow-hidden rounded-sm"
            style={{ backgroundColor: color }}
          >
            <span className="shrink-0 w-2 h-2 rounded-full bg-white/80" />
            <span className="truncate text-xs font-bold text-black flex-1">{name}</span>
            {valuePart && (
              <span className="shrink-0 text-xs font-bold text-white">
                {valuePart}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (props.type === TransactionType.Income) {
                  deleteIncome(settingKey, props.recordId).then(onEventDelete)
                } else {
                  deleteExpense(settingKey, props.recordId).then(onEventDelete)
                }
              }}
              className="shrink-0 text-white/70 hover:text-white leading-none ml-1"
            >
              ×
            </button>
          </div>
        )
      }}
      eventDrop={(info) => {
        const { recordId, type } = info.event.extendedProps as { recordId: number; type: TransactionType }
        const newDate = info.event.start
        if (!newDate) return
        if (type === TransactionType.Income) {
          updateIncome(settingKey, recordId, { date: newDate })
        } else {
          updateExpense(settingKey, recordId, { date: newDate })
        }
      }}
      events={events}
    />
  )
}
