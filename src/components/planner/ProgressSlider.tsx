'use client'

import { useEffect, useState } from 'react'

interface Props {
  value: number
  color: string
  label: string
  onCommit: (value: number) => void
}

/** A 0–100% range slider that only saves once the user lets go, not on every step of the drag. */
export function ProgressSlider({ value, color, label, onCommit }: Props) {
  const [draft, setDraft] = useState(value)

  useEffect(() => setDraft(value), [value])

  const commit = () => {
    if (draft !== value) onCommit(draft)
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={draft}
        aria-label={label}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="h-1.5 min-w-24 flex-1 cursor-pointer"
        style={{ accentColor: color }}
      />
      <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{draft}%</span>
    </div>
  )
}
