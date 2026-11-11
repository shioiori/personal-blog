'use client'

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

const DAY_COUNT = 7
const MIN_WIDTH = 6

export const EQUAL_COLUMN_WIDTHS = Array.from({ length: DAY_COUNT }, () => 100 / DAY_COUNT)

const COLUMN_CSS = Array.from(
  { length: DAY_COUNT },
  (_, i) =>
    `.planner-calendar .fc-col-header-cell:nth-child(${i + 1}), .planner-calendar .fc-daygrid-day:nth-child(${i + 1}) { width: var(--planner-col-${i}); }`
).join('\n')

export function columnWidthVars(widths: number[]): CSSProperties {
  return Object.fromEntries(widths.map((w, i) => [`--planner-col-${i}`, `${w}%`])) as CSSProperties
}

interface Props {
  containerRef: RefObject<HTMLDivElement | null>
  widths: number[]
  onChange: (widths: number[]) => void
}

export function ColumnResizeHandles({ containerRef, widths, onChange }: Props) {
  const [grid, setGrid] = useState<{ top: number; height: number } | null>(null)
  const drag = useRef<{ index: number; startX: number; startWidths: number[]; containerWidth: number } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const measure = () => {
      const el = container.querySelector<HTMLElement>('.fc-scrollgrid')
      if (!el) return
      const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top
      setGrid({ top, height: el.offsetHeight })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    measure()
    return () => observer.disconnect()
  }, [containerRef])

  const boundaries = widths.slice(0, -1).map((_, i) => widths.slice(0, i + 1).reduce((sum, w) => sum + w, 0))

  return (
    <>
      <style>{COLUMN_CSS}</style>
      {grid &&
        boundaries.map((left, i) => (
          <div
            key={i}
            role="separator"
            aria-orientation="vertical"
            className="absolute z-10 w-2 -translate-x-1/2 cursor-col-resize touch-none hover:bg-indigo-300/50"
            style={{ left: `${left}%`, top: grid.top, height: grid.height }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              drag.current = { index: i, startX: e.clientX, startWidths: widths, containerWidth: containerRef.current?.offsetWidth ?? 1 }
            }}
            onPointerMove={(e) => {
              const d = drag.current
              if (!d) return
              const a = d.startWidths[d.index]
              const b = d.startWidths[d.index + 1]
              const delta = ((e.clientX - d.startX) / d.containerWidth) * 100
              const clamped = Math.max(MIN_WIDTH - a, Math.min(b - MIN_WIDTH, delta))
              onChange(d.startWidths.map((w, j) => (j === d.index ? a + clamped : j === d.index + 1 ? b - clamped : w)))
            }}
            onPointerUp={() => {
              drag.current = null
            }}
            onPointerCancel={() => {
              drag.current = null
            }}
          />
        ))}
    </>
  )
}
