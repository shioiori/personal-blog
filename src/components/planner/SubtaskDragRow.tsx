'use client'

import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  disabled: boolean
  onDragStart: (e: PointerEvent, row: HTMLElement) => void
  children: ReactNode
}

// Sits inside its parent's FullCalendar event, so the native mousedown/touchstart must be stopped
// before it reaches FullCalendar's listener — otherwise grabbing this row drags the whole group.
export function SubtaskDragRow({ disabled, onDragStart, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const latest = useRef({ disabled, onDragStart })
  latest.current = { disabled, onDragStart }

  useEffect(() => {
    const row = ref.current
    if (!row) return
    const stop = (e: Event) => e.stopPropagation()
    const down = (e: PointerEvent) => {
      if (!latest.current.disabled) latest.current.onDragStart(e, row)
    }
    row.addEventListener('mousedown', stop)
    row.addEventListener('touchstart', stop, { passive: true })
    row.addEventListener('pointerdown', down)
    return () => {
      row.removeEventListener('mousedown', stop)
      row.removeEventListener('touchstart', stop)
      row.removeEventListener('pointerdown', down)
    }
  }, [])

  return <div ref={ref}>{children}</div>
}
