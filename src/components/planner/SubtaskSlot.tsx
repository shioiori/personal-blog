'use client'

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { addDays, dayDiff } from '@/src/lib/planner-range'

export function dayCellAt(x: number, y: number) {
  return document.elementsFromPoint(x, y).find((el): el is HTMLElement => el.matches('.fc-daygrid-day'))
}

interface Layout {
  left: number
  right: number
  isStart: boolean
  isEnd: boolean
}

interface Props {
  spanStart: string
  offset: number
  length: number
  maxLength: number
  resizable: boolean
  onResize: (length: number) => void
  children: (edges: { isStart: boolean; isEnd: boolean }) => ReactNode
}

export function SubtaskSlot({ spanStart, offset, length, maxLength, resizable, onResize, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const [layout, setLayout] = useState<Layout | null>(null)
  const start = addDays(spanStart, offset)
  const end = addDays(start, preview ?? length)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    function measure() {
      const box = (root as HTMLDivElement).getBoundingClientRect()
      const cells = [...((root as HTMLDivElement).closest('tr')?.querySelectorAll<HTMLElement>('td.fc-daygrid-day[data-date]') ?? [])]
        .map((cell) => ({ date: cell.dataset.date as string, rect: cell.getBoundingClientRect() }))
        .filter(({ date, rect }) => date >= start && date <= end && rect.right > box.left + 1 && rect.left < box.right - 1)
      if (!cells.length) return setLayout(null)
      const first = cells[0]
      const last = cells[cells.length - 1]
      setLayout({
        left: Math.max(0, first.rect.left - box.left),
        right: Math.max(0, box.right - last.rect.right),
        isStart: first.date === start,
        isEnd: last.date === end
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [start, end])

  function handleResizeStart(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    let next = length
    const handleMove = (ev: PointerEvent) => {
      const date = dayCellAt(ev.clientX, ev.clientY)?.dataset.date
      if (!date) return
      next = Math.min(maxLength, Math.max(0, dayDiff(start, date)))
      setPreview(next)
    }
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      setPreview(null)
      if (next !== length) onResize(next)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  return (
    <div ref={rootRef} className="w-full">
      {layout ? (
        <div data-subtask-visible className="relative" style={{ marginLeft: layout.left, marginRight: layout.right }}>
          {children({ isStart: layout.isStart, isEnd: layout.isEnd })}
          {resizable && layout.isEnd && (
            <div
              onPointerDown={handleResizeStart}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"
            />
          )}
        </div>
      ) : (
        <div aria-hidden className="invisible py-px text-xs">&nbsp;</div>
      )}
    </div>
  )
}
