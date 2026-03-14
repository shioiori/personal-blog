import { useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { FinanceEvent, Income } from '@/src/declaration/finance'
import { FINANCE_TRANSACTION } from '@/src/constants'
import { emitter } from '@/src/utils/emitter'

export default function Calendar({
  setShowModal
}: {
  setShowModal: (v: boolean) => void
}) {
  const calendarRef = useRef(null)
  const [events, setEvents] = useState<FinanceEvent[]>([])

  const fetchEvents = () => {
    const data = localStorage.getItem(FINANCE_TRANSACTION)
    const transaction = data ? JSON.parse(data) : []
    console.log(
      transaction.incomes?.map((x: Income) => ({
        id: crypto.randomUUID(),
        eventId: x.id,
        start: x.date,
        title: x.name
      }))
    )
    setEvents(
      transaction.incomes?.map((x: Income) => ({
        id: crypto.randomUUID(),
        eventId: x.id,
        start: x.date,
        title: x.name
      }))
    )
  }

  useEffect(() => {
    fetchEvents()
    emitter.on('add-income', fetchEvents)
    return () => {
      emitter.off('add-income', fetchEvents)
    }
  }, [])

  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[dayGridPlugin, interactionPlugin]}
      initialView={'dayGridMonth'}
      selectable
      editable
      dateClick={(e) => setShowModal(true)}
      eventDrop={(info) => {
        console.log('Moved event:', info.event.title)
        console.log('New date:', info.event.start)
      }}
      events={events}
    ></FullCalendar>
  )
}
