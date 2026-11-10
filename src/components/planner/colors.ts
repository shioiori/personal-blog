export interface PlannerColor {
  bar: string
  fill: string
  fillChecked: string
  text: string
  bg: string
}

const PASTEL_PALETTE: PlannerColor[] = [
  { bar: '#C7D2FE', fill: '#E0E7FF', fillChecked: '#C7D2FE', text: '#6366F1', bg: '#EEF2FF' },
  { bar: '#FBCFE8', fill: '#FCE7F3', fillChecked: '#FBCFE8', text: '#EC4899', bg: '#FDF2F8' },
  { bar: '#99F6E4', fill: '#CCFBF1', fillChecked: '#99F6E4', text: '#14B8A6', bg: '#F0FDFA' },
  { bar: '#FDE68A', fill: '#FEF3C7', fillChecked: '#FDE68A', text: '#F59E0B', bg: '#FFFBEB' },
  { bar: '#BAE6FD', fill: '#E0F2FE', fillChecked: '#BAE6FD', text: '#0EA5E9', bg: '#F0F9FF' },
  { bar: '#DDD6FE', fill: '#EDE9FE', fillChecked: '#DDD6FE', text: '#8B5CF6', bg: '#F5F3FF' },
  { bar: '#FECACA', fill: '#FEE2E2', fillChecked: '#FECACA', text: '#F87171', bg: '#FEF2F2' },
  { bar: '#BBF7D0', fill: '#DCFCE7', fillChecked: '#BBF7D0', text: '#4ADE80', bg: '#F0FDF4' }
]

export function colorForTask(id: number | string): PlannerColor {
  const str = String(id)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return PASTEL_PALETTE[hash % PASTEL_PALETTE.length]
}
