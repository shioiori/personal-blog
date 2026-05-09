'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback
} from 'react'

interface ChineseContextValue {
  learnedChars: Set<string>
  toggleLearned: (char: string) => void
  markLearned: (chars: string[]) => void
}

const ChineseContext = createContext<ChineseContextValue | null>(null)

export function ChineseProvider({ children }: { children: React.ReactNode }) {
  const [learnedChars, setLearnedChars] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/chinese/state')
      .then((r) => r.json())
      .then((data: Record<string, boolean>) => {
        setLearnedChars(
          new Set(
            Object.entries(data)
              .filter(([, v]) => v)
              .map(([k]) => k)
          )
        )
      })
      .catch(() => {})
  }, [])

  const toggleLearned = useCallback((char: string) => {
    setLearnedChars((prev) => {
      const next = new Set(prev)
      const nowLearned = !next.has(char)
      if (nowLearned) next.add(char)
      else next.delete(char)
      void fetch('/api/chinese/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ char, hidden: nowLearned })
      })
      return next
    })
  }, [])

  const markLearned = useCallback((chars: string[]) => {
    setLearnedChars((prev) => {
      const next = new Set(prev)
      const newChars = chars.filter((c) => !next.has(c))
      if (newChars.length === 0) return prev
      for (const c of newChars) next.add(c)
      void Promise.all(
        newChars.map((char) =>
          fetch('/api/chinese/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ char, hidden: true })
          })
        )
      )
      return next
    })
  }, [])

  return (
    <ChineseContext.Provider value={{ learnedChars, toggleLearned, markLearned }}>
      {children}
    </ChineseContext.Provider>
  )
}

export function useLearnedChars() {
  const ctx = useContext(ChineseContext)
  if (!ctx)
    throw new Error('useLearnedChars must be used within ChineseProvider')
  return ctx
}
