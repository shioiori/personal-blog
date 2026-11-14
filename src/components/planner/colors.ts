export interface PlannerColor {
  bar: string
  fill: string
  fillChecked: string
  text: string
  bg: string
}

const HUES = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345]

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const toHex = (n: number) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`
}

const PASTEL_PALETTE: PlannerColor[] = HUES.map((h) => ({
  bar: hslToHex(h, 70, 80),
  fill: hslToHex(h, 70, 91),
  fillChecked: hslToHex(h, 70, 80),
  text: hslToHex(h, 60, 50),
  bg: hslToHex(h, 70, 97)
}))

/** Pastel dot colors for user-created categories, one per hue in the task palette. */
export const CATEGORY_COLORS: string[] = PASTEL_PALETTE.map((c) => c.bar)

export function colorForTask(id: number | string): PlannerColor {
  const str = String(id)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return PASTEL_PALETTE[hash % PASTEL_PALETTE.length]
}
