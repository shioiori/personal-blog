export type DateRange = { date: string; endDate: string | null }

export function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function dayDiff(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

export function rangeEnd(range: DateRange) {
  return range.endDate ?? range.date
}

export function isWithin(inner: DateRange, outer: DateRange) {
  return inner.date >= outer.date && rangeEnd(inner) <= rangeEnd(outer)
}

export function shiftRange(range: DateRange, days: number): DateRange {
  return { date: addDays(range.date, days), endDate: range.endDate && addDays(range.endDate, days) }
}

export function fitChildRange(child: DateRange, before: DateRange, after: DateRange): DateRange {
  if (child.date === before.date && rangeEnd(child) === rangeEnd(before)) return { date: after.date, endDate: after.endDate }
  const moved = dayDiff(before.date, rangeEnd(before)) === dayDiff(after.date, rangeEnd(after))
  const shift = moved ? dayDiff(before.date, after.date) : 0
  const clamp = (d: string) => (d < after.date ? after.date : d > rangeEnd(after) ? rangeEnd(after) : d)
  const start = clamp(addDays(child.date, shift))
  const last = clamp(addDays(rangeEnd(child), shift))
  return { date: start, endDate: last > start ? last : null }
}
