import { useEffect, useState } from 'react'
import { Card } from '../ui/Card'
import TransactionModal from './TransactionModal'
import Calendar from './Calendar'

export default function TransactionTab() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="space-y-6">
      <div className="w-full">
        <Card className="border border-border bg-card p-6 lg:col-span-2">
          <Calendar setShowModal={setShowModal} />
        </Card>
      </div>
      <TransactionModal
        showModal={showModal}
        closeModal={() => setShowModal(false)}
        selectedDate={selectedDate || new Date()}
      />
    </div>
  )
}
