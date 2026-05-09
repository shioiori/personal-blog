'use client'

import { useState, useRef } from 'react'
import { Upload, X, Check } from 'lucide-react'
import { cn } from '@/src/utils/ui'
import { useLearnedChars } from '@/src/context/chinese'

function isCjk(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df) ||
    (code >= 0xf900 && code <= 0xfaff)
  )
}

function parseCharsFromText(text: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const first = [...trimmed][0]
    if (first && isCjk(first) && !seen.has(first)) {
      seen.add(first)
      result.push(first)
    }
  }
  return result
}

type Stage = 'idle' | 'preview' | 'done'

export function ImportTab() {
  const { markLearned } = useLearnedChars()
  const [stage, setStage] = useState<Stage>('idle')
  const [chars, setChars] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setChars(parseCharsFromText(text))
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

  function handleConfirm() {
    if (chars.length === 0) return
    markLearned(chars)
    setStage('done')
  }

  function handleCancel() {
    setChars([])
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
          <span className="font-medium text-foreground">{chars.length}</span> chữ
          là đã học.
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
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Tìm thấy{' '}
            <span className="font-medium text-foreground">{chars.length}</span>{' '}
            hán tự. Xác nhận để đánh dấu tất cả là đã học.
          </p>
          <button
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {chars.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Không tìm thấy hán tự nào trong file.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto rounded-lg border border-border p-4">
            {chars.map((ch) => (
              <span
                key={ch}
                className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-border bg-muted text-lg"
                style={{ fontFamily: 'var(--font-noto-serif-sc), serif' }}
              >
                {ch}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={chars.length === 0}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:pointer-events-none'
            )}
          >
            OK – Đánh dấu đã học
          </button>
          <button
            onClick={handleCancel}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors border border-border',
              'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
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
        <code className="text-xs bg-muted px-1 py-0.5 rounded">.csv</code>.
        Mỗi dòng lấy ký tự đầu tiên — nếu là hán tự sẽ được đánh dấu là đã học.
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
          <span className="text-primary underline underline-offset-2">
            chọn file
          </span>
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
