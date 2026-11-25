'use client'

import { memo, type CSSProperties, type FocusEvent, type KeyboardEvent, type RefObject, type SetStateAction } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, EyeOff, Plus, X } from 'lucide-react'
import { PlannerCategory, PlannerStatus, PlannerTask } from '@/src/declaration/planner'
import { colorForTask } from '@/src/components/planner/colors'
import { SegmentText } from '@/src/components/planner/SegmentText'
import type { SlotLayout } from '@/src/components/planner/SubtaskSlot'

export const DRAFT_ID = 'draft'
export const SUBTASK_DRAFT_PREFIX = 'subtask-draft-'

/** A wavy waterline filling the bottom of the icon, used for the "partially done" status. */
function wavyFill(bar: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M0,6.5 Q1.5,5 3,6.5 T6,6.5 T9,6.5 T12,6.5 L12,12 L0,12 Z' fill='${bar}'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export function statusCheckboxStyle(bar: string, status: PlannerStatus): CSSProperties {
  return {
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
    height: 12,
    width: 12,
    borderRadius: 9999,
    border: `2px solid ${bar}`,
    backgroundColor: status === 'done' ? bar : 'transparent',
    backgroundImage: status === 'partial' ? wavyFill(bar) : undefined,
    backgroundSize: 'cover',
    margin: 0
  }
}

let measureContext: CanvasRenderingContext2D | null = null

function charIndexAtX(text: string, x: number, font: string) {
  measureContext ??= document.createElement('canvas').getContext('2d')
  if (!measureContext) return text.length
  measureContext.font = font
  let low = 0
  let high = text.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (measureContext.measureText(text.slice(0, mid)).width <= x) low = mid
    else high = mid - 1
  }
  return low
}

function autoSize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export interface PillActions {
  copy: (task: PlannerTask) => void
  addSubtask: (taskId: number) => void
  remove: (taskId: number) => void
  hide: (taskId: number) => void
  open: (taskId: number) => void
  toggle: (task: PlannerTask) => void
  assignCategory: (taskId: number, categoryId: number | null) => void
  setDragOver: (update: SetStateAction<number | null>) => void
  startEdit: (taskId: number) => void
  commit: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>, taskId: number | null) => void
  commitSubtaskDraft: (e: FocusEvent<HTMLInputElement>, parentId: number) => void
  inputKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void
}

interface Props {
  eventId: string
  title: string
  isStart: boolean
  isEnd: boolean
  segmentKey: string
  task: PlannerTask | undefined
  status: PlannerStatus
  category: PlannerCategory | undefined
  editing: boolean
  wrap: boolean
  highlighted: boolean
  segmentEnds: Record<string, number> | undefined
  onMeasure: (segmentKey: string, segmentStart: string, end: number) => void
  actions: RefObject<PillActions | null>
  slot?: SlotLayout
}

export const TaskPill = memo(function TaskPill({
  eventId,
  title,
  isStart,
  isEnd,
  segmentKey,
  task,
  status,
  category,
  editing,
  wrap,
  highlighted,
  segmentEnds,
  onMeasure,
  actions,
  slot
}: Props) {
  const t = useTranslations('Planner')
  const isSubtaskDraft = eventId.startsWith(SUBTASK_DRAFT_PREFIX)
  const subtaskDraftParent = isSubtaskDraft ? Number(eventId.slice(SUBTASK_DRAFT_PREFIX.length)) : null
  const taskId = task?.id ?? null
  const pending = taskId !== null && taskId < 0
  const readOnly = !task || pending
  const isSubtask = !!task?.parentId
  const color = colorForTask(pending ? DRAFT_ID : eventId)
  const act = () => actions.current as PillActions
  const textClass = status === 'done' ? 'line-through opacity-70' : status === 'partial' ? 'opacity-70' : ''
  const startEdit = () => {
    if (!readOnly) act().startEdit(task.id)
  }

  const buttons = !readOnly && (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          act().copy(task)
        }}
        title={t('copyTask')}
        className="shrink-0 hidden group-hover:block text-muted-foreground hover:text-foreground"
      >
        <Copy className="h-3 w-3" />
      </button>
      {!isSubtask && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            act().addSubtask(task.id)
          }}
          title={t('addSubtask')}
          className="shrink-0 hidden group-hover:block text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          act().hide(task.id)
        }}
        title={t('hideTask')}
        className="shrink-0 hidden group-hover:block text-muted-foreground hover:text-foreground"
      >
        <EyeOff className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          act().remove(task.id)
        }}
        className="shrink-0 hidden group-hover:block text-muted-foreground hover:text-destructive"
      >
        <X className="h-3 w-3" />
      </button>
    </>
  )

  return (
    <div
      data-task-id={taskId ?? undefined}
      className={`group flex items-center gap-1 w-full cursor-pointer active:cursor-grabbing ${isStart ? 'pl-0.5' : ''} ${pending ? 'opacity-60' : ''} ${wrap ? 'items-start' : 'overflow-hidden'}`}
      style={{ paddingLeft: isSubtask || isSubtaskDraft ? 16 : undefined }}
      onContextMenu={(e) => {
        if (readOnly) return
        e.preventDefault()
        e.stopPropagation()
        act().open(task.id)
      }}
    >
      {isStart && isSubtaskDraft && <span className="shrink-0" style={{ height: 12, width: 12 }} />}
      {isStart && !isSubtaskDraft && (
        <input
          type="checkbox"
          checked={status === 'done'}
          ref={(el) => {
            if (el) el.indeterminate = status === 'partial'
          }}
          disabled={readOnly}
          onClick={(e) => e.stopPropagation()}
          onChange={() => {
            if (!readOnly) act().toggle(task)
          }}
          className={`shrink-0 cursor-pointer ${wrap ? 'mt-1' : ''}`}
          style={statusCheckboxStyle(color.bar, status)}
        />
      )}
      <div
        data-pill-bg
        className="flex min-w-0 flex-1 items-center gap-1 px-1.5 py-px"
        style={{
          backgroundColor: `${color.bar}4D`,
          ...slot?.background,
          paddingLeft: slot?.textInset ? slot.textInset + 6 : undefined,
          borderTopLeftRadius: isStart ? 6 : 0,
          borderBottomLeftRadius: isStart ? 6 : 0,
          borderTopRightRadius: isEnd ? 6 : 0,
          borderBottomRightRadius: isEnd ? 6 : 0,
          boxShadow: highlighted && !readOnly ? 'inset 0 0 0 2px currentColor' : undefined
        }}
        onDragOver={(e) => {
          if (readOnly || !e.dataTransfer.types.includes('text/planner-category-id')) return
          e.preventDefault()
          act().setDragOver(task.id)
        }}
        onDragLeave={() => act().setDragOver((prev) => (prev === taskId ? null : prev))}
        onDrop={(e) => {
          act().setDragOver(null)
          if (readOnly) return
          const dropped = e.dataTransfer.getData('text/planner-category-id')
          if (!dropped) return
          e.preventDefault()
          act().assignCategory(task.id, Number(dropped))
        }}
      >
        {(slot?.titleStart ?? isStart) && category && (
          <span
            title={category.name}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (!readOnly) act().assignCategory(task.id, null)
            }}
            className="h-2 w-2 shrink-0 rounded-full cursor-pointer"
            style={{ backgroundColor: category.color }}
          />
        )}
        {isSubtaskDraft ? (
          <input
            data-planner-input
            autoFocus
            placeholder={t('addSubtaskPlaceholder')}
            onBlur={(e) => act().commitSubtaskDraft(e, subtaskDraftParent as number)}
            onKeyDown={(e) => act().inputKeyDown(e)}
            className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
            style={{ color: color.text }}
          />
        ) : editing && wrap ? (
          <textarea
            data-planner-input
            autoFocus
            rows={1}
            defaultValue={title}
            placeholder={t('taskPlaceholder')}
            onBlur={(e) => act().commit(e, taskId)}
            onKeyDown={(e) => act().inputKeyDown(e)}
            onFocus={(e) => autoSize(e.currentTarget)}
            onInput={(e) => autoSize(e.currentTarget)}
            className="min-w-0 flex-1 resize-none bg-transparent text-xs font-medium outline-none"
            style={{ color: color.text, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          />
        ) : editing ? (
          <input
            data-planner-input
            autoFocus
            defaultValue={title}
            placeholder={t('taskPlaceholder')}
            onBlur={(e) => act().commit(e, taskId)}
            onKeyDown={(e) => act().inputKeyDown(e)}
            onMouseDown={(e) => {
              // FullCalendar's interaction plugin preventDefaults mousedown on
              // .fc-event to suppress native drag/selection, which also blocks the
              // browser's native click-to-reposition-caret behavior here. Compute
              // and apply the caret position ourselves instead of relying on it.
              const input = e.currentTarget
              const x = e.clientX - input.getBoundingClientRect().left
              const index = charIndexAtX(input.value, x, getComputedStyle(input).font)
              requestAnimationFrame(() => input.setSelectionRange(index, index))
            }}
            className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
            style={{ color: color.text }}
          />
        ) : wrap ? (
          <>
            <span
              className={`min-w-0 flex-1 text-xs font-medium ${textClass}`}
              style={{ color: color.text, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
              onClick={startEdit}
            >
              {(slot?.titleStart ?? isStart) ? title || ' ' : ' '}
            </span>
            {buttons}
          </>
        ) : (
          <>
            {slot?.textInset === null ? (
              <span className="min-w-0 flex-1 text-xs" onClick={startEdit}>
                {' '}
              </span>
            ) : (
              <SegmentText
                text={title}
                segmentKey={segmentKey}
                ends={segmentEnds}
                isEnd={isEnd}
                onMeasure={onMeasure}
                className={`min-w-0 flex-1 truncate text-xs font-medium ${textClass}`}
                style={{ color: color.text }}
                onClick={startEdit}
              />
            )}
            {buttons}
          </>
        )}
      </div>
    </div>
  )
})
