'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { addDays } from '@/src/lib/planner-range'

export function dayCellAt(x: number, y: number) {
  return document.elementsFromPoint(x, y).find((el): el is HTMLElement => el.matches('.fc-daygrid-day'))
}

export interface SlotLayout {
  background?: CSSProperties
  textInset?: number | null
  titleStart?: boolean
}

interface Props {
  spanStart: string
  offset: number
  length: number
  color: string
  children: (layout: SlotLayout) => ReactNode
}

export function SubtaskSlot({ spanStart, offset, length, color, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<SlotLayout>({})
  const start = addDays(spanStart, offset)
  const end = addDays(start, length)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const solid = `linear-gradient(${color}, ${color})`
    const hatch = `repeating-linear-gradient(135deg, ${color} 0 2px, transparent 2px 6px)`
    function measure() {
      const bg = (root as HTMLDivElement).querySelector<HTMLElement>('[data-pill-bg]')
      if (!bg) return
      const box = bg.getBoundingClientRect()
      const segment = [...((root as HTMLDivElement).closest('tr')?.querySelectorAll<HTMLElement>('td.fc-daygrid-day[data-date]') ?? [])]
        .map((cell) => ({ date: cell.dataset.date ?? '', rect: cell.getBoundingClientRect() }))
        .filter(({ rect }) => rect.right > box.left + 1 && rect.left < box.right - 1)
      const own = segment.filter(({ date }) => date >= start && date <= end)
      const from = own.length ? Math.max(0, own[0].rect.left - box.left) : box.width
      const to = own.length ? Math.min(box.width, own[own.length - 1].rect.right - box.left) : box.width
      const layers: [string, number, number][] = []
      if (from > 0) layers.push([hatch, 0, from])
      if (to > from) layers.push([solid, from, to - from])
      if (to < box.width) layers.push([hatch, to, box.width - to])
      const titleStart = segment.some(({ date }) => date === start)
      const beforeStart = segment.every(({ date }) => date < start)
      setLayout({
        background: {
          backgroundColor: 'transparent',
          backgroundImage: layers.map(([image]) => image).join(', '),
          backgroundPosition: layers.map(([, x]) => `${x}px 0`).join(', '),
          backgroundSize: layers.map(([, , width]) => `${width}px 100%`).join(', '),
          backgroundRepeat: 'no-repeat'
        },
        textInset: titleStart ? from : beforeStart ? null : 0,
        titleStart
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [start, end, color])

  return (
    <div ref={rootRef} className="w-full">
      {children(layout)}
    </div>
  )
}
