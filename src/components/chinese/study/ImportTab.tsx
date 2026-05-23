'use client'

import { useState, useRef } from 'react'
import { Upload, X, Check } from 'lucide-react'
import { cn } from '@/src/utils/ui'
import { useLearnedChars } from '@/src/context/chinese'

function isCjk(s: string): boolean {
  const code = s.codePointAt(0) ?? 0
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df) ||
    (code >= 0xf900 && code <= 0xfaff)
  )
}

function isAllCjk(s: string): boolean {
  return s.length > 0 && [...s].every(isCjk)
}

function stripQuotes(s: string): string {
  return s.replace(/^"+|"+$/g, '').trim()
}

interface ParsedEntry {
  word: string      // hán tự (1 hoặc nhiều ký tự)
  pinyin: string
  hanViet: string
  meaning: string
}

function parseFile(text: string): { singles: string[]; compounds: ParsedEntry[] } {
  const seenSingle = new Set<string>()
  const seenCompound = new Set<string>()
  const singles: string[] = []
  const compounds: ParsedEntry[] = []

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parts = trimmed.split(';')
    const word = stripQuotes(parts[0] ?? '')

    if (!isAllCjk(word)) continue

    if ([...word].length === 1) {
      if (!seenSingle.has(word)) {
        seenSingle.add(word)
        singles.push(word)
      }
    } else {
      if (!seenCompound.has(word)) {
        seenCompound.add(word)
        compounds.push({
          word,
          pinyin: stripQuotes(parts[1] ?? ''),
          hanViet: stripQuotes(parts[2] ?? '').toLowerCase(),
          meaning: stripQuotes(parts[3] ?? ''),
        })
      }
    }
  }

  return { singles, compounds }
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json() as Promise<T>
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path)
  return res.json() as Promise<T>
}

type Stage = 'idle' | 'preview' | 'done'

interface DoneStats {
  singles: number
  compounds: number
}

export function ImportTab() {
  const { markLearned, learnedChars } = useLearnedChars()
  const [stage, setStage] = useState<Stage>('idle')
  const [singles, setSingles] = useState<string[]>([])
  const [compounds, setCompounds] = useState<ParsedEntry[]>([])
  const [existingCompounds, setExistingCompounds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [doneStats, setDoneStats] = useState<DoneStats>({ singles: 0, compounds: 0 })
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      const parsed = parseFile(text)
      setSingles(parsed.singles)
      setCompounds(parsed.compounds)

      const existing = await apiGet<{ word: string }[]>('/api/chinese/compound-words')
      setExistingCompounds(new Set(existing.map((w) => w.word)))

      setStage('preview')
    }
    reader.readAsText(file, 'utf-8')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  async function handleConfirm() {
    const newSingles = singles.filter((ch) => !learnedChars.has(ch))
    const newCompounds = compounds.filter((c) => !existingCompounds.has(c.word))
    if (newSingles.length === 0 && newCompounds.length === 0) return
    setSaving(true)
    try {
      if (newSingles.length > 0) markLearned(newSingles)

      if (newCompounds.length > 0) {
        const categories = await apiGet<{ id: number; name: string }[]>(
          '/api/chinese/compound-categories'
        )
        let khacId = categories.find((c) => c.name === 'Khác')?.id ?? null
        if (khacId === null) {
          const created = await apiPost<{ id: number }>(
            '/api/chinese/compound-categories',
            { name: 'Khác' }
          )
          khacId = created.id
        }

        await Promise.all(
          newCompounds.map((c) =>
            apiPost('/api/chinese/compound-words', {
              word: c.word,
              pinyin: c.pinyin,
              hanViet: c.hanViet,
              meaning: c.meaning,
              note: '',
              categoryIds: [khacId],
            })
          )
        )
      }

      setDoneStats({ singles: newSingles.length, compounds: newCompounds.length })
      setStage('done')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setSingles([])
    setCompounds([])
    setStage('idle')
  }

  if (stage === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center">
          <Check className="w-6 h-6 text-green-500" />
        </div>
        <p className="text-sm text-muted-foreground">
          Đã đánh dấu{' '}
          <span className="font-medium text-foreground">{doneStats.singles}</span>{' '}
          chữ đơn là đã học
          {doneStats.compounds > 0 && (
            <>
              {' '}và lưu{' '}
              <span className="font-medium text-foreground">{doneStats.compounds}</span>{' '}
              từ ghép
            </>
          )}
          .
        </p>
        <button
          onClick={handleCancel}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Import thêm
        </button>
      </div>
    )
  }

  if (stage === 'preview') {
    const newSingles = singles.filter((ch) => !learnedChars.has(ch))
    const skippedSingles = singles.length - newSingles.length
    const newCompounds = compounds.filter((c) => !existingCompounds.has(c.word))
    const skippedCompounds = compounds.length - newCompounds.length
    const totalEmpty = newSingles.length === 0 && newCompounds.length === 0
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Tìm thấy{' '}
            <span className="font-medium text-foreground">{newSingles.length}</span>{' '}
            chữ đơn mới,{' '}
            <span className="font-medium text-foreground">{newCompounds.length}</span>{' '}
            từ ghép mới.
            {(skippedSingles > 0 || skippedCompounds > 0) && (
              <span className="ml-1 text-xs text-muted-foreground/60">
                (bỏ qua {[
                  skippedSingles > 0 && `${skippedSingles} chữ đơn đã học`,
                  skippedCompounds > 0 && `${skippedCompounds} từ ghép đã có`,
                ].filter(Boolean).join(', ')})
              </span>
            )}
          </p>
          <button
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {totalEmpty ? (
          <p className="text-sm text-muted-foreground italic">
            Tất cả chữ đơn và từ ghép đã có trong dữ liệu.
          </p>
        ) : (
          <div className="space-y-4">
            {newSingles.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Chữ đơn — đánh dấu đã học</p>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto rounded-lg border border-border p-3">
                  {newSingles.map((ch) => (
                    <span
                      key={ch}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-border bg-muted text-lg"
                      style={{ fontFamily: 'var(--font-noto-serif-sc), serif' }}
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {newCompounds.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Từ ghép — lưu vào category "Khác"</p>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded-lg border border-border p-3">
                  {newCompounds.map((c) => (
                    <div key={c.word} className="flex items-baseline gap-2 text-sm">
                      <span
                        className="font-medium shrink-0"
                        style={{ fontFamily: 'var(--font-noto-serif-sc), serif' }}
                      >
                        {c.word}
                      </span>
                      {c.pinyin && (
                        <span className="text-muted-foreground text-xs">{c.pinyin}</span>
                      )}
                      {c.meaning && (
                        <span className="text-muted-foreground text-xs truncate">{c.meaning}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={saving || totalEmpty}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:pointer-events-none'
            )}
          >
            {saving ? 'Đang lưu...' : 'OK – Xác nhận import'}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors border border-border',
              'bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
              'disabled:opacity-50 disabled:pointer-events-none'
            )}
          >
            Hủy
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tải lên file{' '}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">.txt</code> hoặc{' '}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">.csv</code>.{' '}
        Chữ đơn sẽ được đánh dấu đã học, từ ghép sẽ lưu vào từ điển.
      </p>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center gap-3 py-14 rounded-xl border-2 border-dashed border-border',
          'cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors'
        )}
      >
        <Upload className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Kéo thả file vào đây hoặc{' '}
          <span className="text-primary underline underline-offset-2">chọn file</span>
        </p>
        <p className="text-xs text-muted-foreground/60">.txt, .csv</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".txt,.csv,text/plain,text/csv"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  )
}
