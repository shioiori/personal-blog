'use client'

import { useState } from 'react'
import { Card } from '../ui/Card'
import TransactionModal from './TransactionModal'
import Calendar from './Calendar'
import { IncomeDeclaration, TransactionType } from '@/src/declaration/discipline'
import { getIncomes, getExpenses } from '@/src/service/discipline'

export default function TransactionTab({
  settingKey,
  incomeDeclarations
}: {
  settingKey: string
  incomeDeclarations: IncomeDeclaration[]
}) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [showModal, setShowModal] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [editingRecord, setEditingRecord] = useState<{
    id: number
    type: TransactionType
    date: Date
    name: string
    incomeDeclarationId?: number
    quantity?: number
    checked?: boolean
    amount?: number
  } | null>(null)

  function handleDateClick(date: Date) {
    setSelectedDate(date)
    setEditingRecord(null)
    setShowModal(true)
  }

  async function handleEventClick(recordId: number, type: TransactionType) {
    if (type === TransactionType.Income) {
      const incomes = await getIncomes(settingKey)
      const record = incomes.find((x) => x.id === recordId)
      if (!record) return
      setEditingRecord({
        id: recordId,
        type,
        date: record.date,
        name: record.name ?? '',
        incomeDeclarationId: record.incomeDeclarationId,
        quantity: record.quantity,
        checked: record.checked
      })
    } else {
      const expenses = await getExpenses(settingKey)
      const record = expenses.find((x) => x.id === recordId)
      if (!record) return
      setEditingRecord({
        id: recordId,
        type,
        date: record.date,
        name: record.name,
        amount: record.amount
      })
    }
    setShowModal(true)
  }

  function handleTransactionAdded() {
    setRefreshTrigger((n) => n + 1)
  }

  return (
    <div className="space-y-6">
      <div className="w-full">
        <Card className="border border-border bg-card p-6 lg:col-span-2">
          <Calendar
            settingKey={settingKey}
            refreshTrigger={refreshTrigger}
            incomeDeclarations={incomeDeclarations}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onEventDelete={handleTransactionAdded}
          />
        </Card>
      </div>
      <TransactionModal
        showModal={showModal}
        closeModal={() => setShowModal(false)}
        selectedDate={editingRecord ? editingRecord.date : selectedDate}
        settingKey={settingKey}
        incomeDeclarations={incomeDeclarations}
        editingRecord={editingRecord}
        onTransactionAdded={handleTransactionAdded}
      />
    </div>
  )
}
