'use client'

import { useEffect, type ReactNode } from 'react'
import { VT323 } from 'next/font/google'

// Pixel font with Vietnamese glyphs, so game UI text matches the 16px art.
const pixelFont = VT323({ weight: '400', subsets: ['latin', 'latin-ext', 'vietnamese'], display: 'swap' })

// Palette: dark wood frame, light wood rim, parchment fill.
const WOOD_DARK = '#5a3a22'
const WOOD = '#a0643a'
const WOOD_LIGHT = '#d9a066'
const PAPER = '#f6e3b9'
const PAPER_DARK = '#e3c48e'

/** Hard-edged pixel border made of stacked box-shadows (no blur, no radius). */
const frameShadow = [
  `0 0 0 3px ${WOOD_LIGHT}`,
  `0 0 0 6px ${WOOD}`,
  `0 0 0 9px ${WOOD_DARK}`,
  `6px 9px 0 9px rgba(0,0,0,0.35)`
].join(', ')

/**
 * In-game modal: covers only the game viewport (parent must be `relative`),
 * dims the scene and shows a wooden panel. Esc or clicking the backdrop closes it.
 */
export function GameModal({
  open,
  title,
  onClose,
  children,
  footer
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className={`${pixelFont.className} absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-4 sm:p-6`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-full w-full max-w-[560px] flex-col"
        style={{ background: PAPER, boxShadow: frameShadow, color: WOOD_DARK, animation: 'game-pop 120ms steps(3)' }}
      >
        <div
          className="flex items-center justify-between px-3 py-1 text-2xl leading-none"
          style={{ background: WOOD, color: PAPER, textShadow: `2px 2px 0 ${WOOD_DARK}` }}
        >
          <span className="pt-1">{title}</span>
          <button
            type="button"
            aria-label="close"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center text-xl leading-none"
            style={{ background: '#c0392b', color: PAPER, boxShadow: `inset -2px -2px 0 #7b241c, inset 2px 2px 0 #e57368` }}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 text-lg leading-tight">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-3 pb-3 pt-1 text-lg" style={{ borderTop: `3px solid ${PAPER_DARK}` }}>
            {footer}
          </div>
        )}
      </div>
      <style>{`@keyframes game-pop { from { transform: scale(0.85); } to { transform: scale(1); } }`}</style>
    </div>
  )
}

export function GameButton({
  children,
  onClick,
  disabled,
  variant = 'primary'
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}) {
  const colors =
    variant === 'primary'
      ? { bg: '#6aa84f', hi: '#a4d68a', lo: '#3d6b2b', fg: '#fffbe8' }
      : { bg: PAPER_DARK, hi: '#fff3d6', lo: WOOD, fg: WOOD_DARK }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 pb-1 pt-1.5 text-xl leading-none active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: colors.bg,
        color: colors.fg,
        boxShadow: `inset -3px -3px 0 ${colors.lo}, inset 3px 3px 0 ${colors.hi}, 0 0 0 2px ${WOOD_DARK}`
      }}
    >
      {children}
    </button>
  )
}

/** Inventory-style square slot with an optional count badge. */
export function GameSlot({
  children,
  selected,
  disabled,
  badge,
  label,
  onClick
}: {
  children: ReactNode
  selected?: boolean
  disabled?: boolean
  badge?: ReactNode
  label?: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-center gap-0.5 disabled:cursor-not-allowed"
    >
      <span
        className="relative flex h-14 w-14 items-center justify-center group-disabled:opacity-40"
        style={{
          background: selected ? '#fff3c4' : PAPER_DARK,
          boxShadow: selected
            ? `inset 0 0 0 3px #f1c232, 0 0 0 2px ${WOOD_DARK}`
            : `inset 3px 3px 0 ${WOOD_LIGHT}, inset -3px -3px 0 #f9ecd0, 0 0 0 2px ${WOOD}`
        }}
      >
        {children}
        {badge !== undefined && (
          <span
            className="absolute -bottom-1 -right-1 min-w-[22px] px-1 text-center text-base leading-5"
            style={{ background: WOOD_DARK, color: PAPER }}
          >
            {badge}
          </span>
        )}
      </span>
      {label && <span className="max-w-[72px] truncate text-base leading-none">{label}</span>}
    </button>
  )
}

export function GameSectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 mt-1 text-xl leading-none" style={{ color: WOOD }}>
      ◆ {children}
    </p>
  )
}

export const gameColors = { WOOD_DARK, WOOD, WOOD_LIGHT, PAPER, PAPER_DARK }
