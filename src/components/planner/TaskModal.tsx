'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/Dialog'
import { Button } from '@/src/components/ui/Button'
import { Input } from '@/src/components/ui/Input'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PlannerTask } from '@/src/declaration/planner'
import { colorForTask } from '@/src/components/planner/colors'

interface Row {
  id?: number
  text: string
  checked: boolean
  removed?: boolean
}

export function TaskModal({
  open,
  date,
  tasks,
  onClose,
  onSaved
}: {
  open: boolean
  date: string | null
  tasks: PlannerTask[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('Planner')
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setRows(tasks.map((x) => ({ id: x.id, text: x.text, checked: x.checked })))
    setCopiedFrom(null)
    if (tasks.length > 0 || !date) return
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/planner/tasks?before=${date}`)
      if (!res.ok || cancelled) return
      const previous = (await res.json()) as PlannerTask[]
      if (cancelled || previous.length === 0) return
      setRows((prev) => (prev.length === 0 ? previous.map((x) => ({ text: x.text, checked: false })) : prev))
      setCopiedFrom(previous[0].date)
    })()
    return () => {
      cancelled = true
    }
  }, [open, tasks, date])

  function handleAdd() {
    setRows((prev) => [...prev, { text: '', checked: false }])
  }

  function handleChangeText(index: number, text: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, text } : r)))
  }

  function handleToggleChecked(index: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, checked: !r.checked } : r)))
  }

  function handleRemove(index: number) {
    setRows((prev) =>
      prev
        .map((r, i) => (i === index ? { ...r, removed: true } : r))
        .filter((r) => r.id || !r.removed)
    )
  }

  async function handleSave() {
    if (!date) return
    setSaving(true)
    try {
      let hasError = false
      for (const row of rows) {
        let res: Response
        if (row.removed && row.id) {
          res = await fetch(`/api/planner/tasks/${row.id}`, { method: 'DELETE' })
        } else if (row.removed) {
          continue
        } else {
          const text = row.text.trim()
          if (!text) continue
          res = row.id
            ? await fetch(`/api/planner/tasks/${row.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, checked: row.checked })
              })
            : await fetch('/api/planner/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, text, checked: row.checked })
              })
        }
        if (!res.ok) hasError = true
      }
      onSaved()
      if (hasError) {
        toast.error(t('saveError'))
      } else {
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  const visibleRows = rows.filter((r) => !r.removed)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{date}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
          {copiedFrom && visibleRows.length > 0 && (
            <p className="text-xs text-muted-foreground">{t('copiedFrom', { date: copiedFrom })}</p>
          )}
          {visibleRows.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noTasks')}</p>
          )}
          {rows.map((row, index) => {
            if (row.removed) return null
            const color = colorForTask(row.id ?? `new-${index}`)
            return (
              <div
                key={row.id ?? `new-${index}`}
                className="flex items-center gap-2 pl-1 pr-1 py-1"
              >
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={() => handleToggleChecked(index)}
                  className="shrink-0 cursor-pointer"
                  style={{
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                    height: 16,
                    width: 16,
                    borderRadius: 9999,
                    border: `2px solid ${color.bar}`,
                    backgroundColor: row.checked ? color.fillChecked : 'transparent',
                    margin: 0
                  }}
                />
                <span
                  className="block shrink-0 self-stretch rounded-full"
                  style={{ backgroundColor: color.bar, width: 3 }}
                />
                <Input
                  value={row.text}
                  onChange={(e) => handleChangeText(index, e.target.value)}
                  placeholder={t('taskPlaceholder')}
                  autoFocus={!row.id}
                  className="h-8 px-1 focus-visible:ring-0"
                  style={{ color: color.text, border: 'none', boxShadow: 'none', background: 'transparent', borderRadius: 0 }}
                />
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })}

          <Button variant="outline" size="sm" onClick={handleAdd} className="mt-1">
            <Plus className="h-4 w-4 mr-1" />
            {t('add')}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{t('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
