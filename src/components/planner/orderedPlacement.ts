import { SegHierarchy, binarySearch, buildEntryKey, getEntrySpanEnd } from '@fullcalendar/core/internal'

type Entry = Parameters<SegHierarchy['findInsertion']>[0]
type Insertion = ReturnType<SegHierarchy['findInsertion']>
interface Hierarchy {
  levelCoords: number[]
  entriesByLevel: Entry[][]
  stackCnts: Record<string, number>
  strictOrder: boolean
  getEntryThickness: (entry: Entry) => number
}

let enabled = false
const original = SegHierarchy.prototype.findInsertion

// FullCalendar's gap-filling layout places each event in the highest free slot it fits, so a later
// event can jump above an earlier one. The planner wants gaps filled while keeping order: an event may
// still rise above events that start on another day, but never above an earlier event that starts on
// the same day. This is FullCalendar's own findInsertion with that floor applied.
function findOrderedInsertion(this: Hierarchy, newEntry: Entry): Insertion {
  const { levelCoords, entriesByLevel, stackCnts } = this
  const levelCnt = levelCoords.length
  const thickness = this.getEntryThickness(newEntry)
  let candidateCoord = 0
  let touchingLevel = -1
  let touchingLateral = -1
  let touchingEntry: Entry | null = null
  let stackCnt = 0

  entriesByLevel.forEach((entries, level) =>
    entries.forEach((entry, lateral) => {
      if (entry.span.start !== newEntry.span.start) return
      const bottom = levelCoords[level] + this.getEntryThickness(entry)
      if (bottom <= candidateCoord) return
      candidateCoord = bottom
      touchingEntry = entry
      touchingLevel = level
      touchingLateral = lateral
      stackCnt = stackCnts[buildEntryKey(entry)] + 1
    })
  )

  for (let trackingLevel = 0; trackingLevel < levelCnt; trackingLevel += 1) {
    const trackingCoord = levelCoords[trackingLevel]
    if (trackingCoord >= candidateCoord + thickness) break
    const trackingEntries = entriesByLevel[trackingLevel]
    const [index, exact] = binarySearch(trackingEntries, newEntry.span.start, getEntrySpanEnd)
    let lateralIndex = index + exact
    let trackingEntry: Entry | undefined
    while ((trackingEntry = trackingEntries[lateralIndex]) && trackingEntry.span.start < newEntry.span.end) {
      const trackingEntryBottom = trackingCoord + this.getEntryThickness(trackingEntry)
      if (trackingEntryBottom > candidateCoord) {
        candidateCoord = trackingEntryBottom
        touchingEntry = trackingEntry
        touchingLevel = trackingLevel
        touchingLateral = lateralIndex
      }
      if (trackingEntryBottom === candidateCoord) {
        stackCnt = Math.max(stackCnt, stackCnts[buildEntryKey(trackingEntry)] + 1)
      }
      lateralIndex += 1
    }
  }

  let destLevel = 0
  if (touchingEntry) {
    destLevel = touchingLevel + 1
    while (destLevel < levelCnt && levelCoords[destLevel] < candidateCoord) destLevel += 1
  }
  let destLateral = -1
  if (destLevel < levelCnt && levelCoords[destLevel] === candidateCoord) {
    destLateral = binarySearch(entriesByLevel[destLevel], newEntry.span.end, getEntrySpanEnd)[0]
  }
  return {
    touchingLevel,
    touchingLateral,
    touchingEntry: touchingEntry as unknown as Entry,
    stackCnt,
    levelCoord: candidateCoord,
    level: destLevel,
    lateral: destLateral
  }
}

SegHierarchy.prototype.findInsertion = function (this: SegHierarchy, newEntry: Entry) {
  const self = this as unknown as Hierarchy
  return enabled && !self.strictOrder ? findOrderedInsertion.call(self, newEntry) : original.call(this, newEntry)
}

// The patch is global to FullCalendar, so only switch it on while the planner calendar is mounted.
export function setOrderedPlacement(on: boolean) {
  enabled = on
}
