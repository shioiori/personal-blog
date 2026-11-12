'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

let context: CanvasRenderingContext2D | null = null

function fitChars(text: string, start: number, width: number, font: string) {
  context ??= document.createElement('canvas').getContext('2d')
  if (!context) return text.length - start
  context.font = font
  let low = 0
  let high = text.length - start
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (context.measureText(text.slice(start, start + mid)).width <= width) low = mid
    else high = mid - 1
  }
  if (start + low >= text.length || text[start + low] === ' ') return low
  const lastSpace = text.slice(start, start + low).lastIndexOf(' ')
  return lastSpace > 0 ? lastSpace : low
}

interface Props {
  text: string
  segmentKey: string
  ends: Record<string, number> | undefined
  isEnd: boolean
  onMeasure: (segmentKey: string, segmentStart: string, end: number) => void
  className: string
  style: CSSProperties
  onClick: () => void
}

export function SegmentText({ text, segmentKey, ends, isEnd, onMeasure, className, style, onClick }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [segmentStart, setSegmentStart] = useState<string | null>(null)

  let start = 0
  if (segmentStart && ends) {
    for (const [key, end] of Object.entries(ends)) if (key < segmentStart) start = Math.max(start, end)
  }
  while (text[start] === ' ') start++
  const end = !isEnd && segmentStart ? ends?.[segmentStart] : undefined

  useLayoutEffect(() => {
    setSegmentStart(ref.current?.closest<HTMLElement>('[data-date]')?.dataset.date ?? null)
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !segmentStart || isEnd) return
    const measure = () => onMeasure(segmentKey, segmentStart, start + fitChars(text, start, el.clientWidth, getComputedStyle(el).font))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, segmentKey, segmentStart, start, isEnd, onMeasure])

  return (
    <span ref={ref} className={className} style={{ ...style, textOverflow: isEnd ? undefined : 'clip' }} onClick={onClick}>
      {text.slice(start, end) || ' '}
    </span>
  )
}
