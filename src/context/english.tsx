'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import type { EnglishWord, EnglishGroup } from '@/src/declaration/english'

interface EnglishContextValue {
  words: EnglishWord[]
  groups: EnglishGroup[]
  loaded: boolean
  refetchWords: () => Promise<void>
  refetchGroups: () => Promise<void>
  refetchAll: () => Promise<void>
}

const EnglishContext = createContext<EnglishContextValue | null>(null)

export function EnglishProvider({ children }: { children: React.ReactNode }) {
  const [words, setWords] = useState<EnglishWord[]>([])
  const [groups, setGroups] = useState<EnglishGroup[]>([])
  const [loaded, setLoaded] = useState(false)

  const fullWordsLoaded = useRef(false)

  const refetchWords = useCallback(async () => {
    const res = await fetch('/api/english/words')
    if (!res.ok) return
    const data = (await res.json()) as EnglishWord[]
    fullWordsLoaded.current = true
    setWords(data)
  }, [])

  const refetchGroups = useCallback(async () => {
    const res = await fetch('/api/english/groups')
    if (res.ok) setGroups((await res.json()) as EnglishGroup[])
  }, [])

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchWords(), refetchGroups()])
  }, [refetchWords, refetchGroups])

  useEffect(() => {
    fetch('/api/english/words?summary=1')
      .then((res) => (res.ok ? (res.json() as Promise<EnglishWord[]>) : null))
      .then((data) => {
        if (!data || fullWordsLoaded.current) return
        setWords(data)
        setLoaded(true)
      })
      .catch(() => {})
    refetchAll()
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [refetchAll])

  const value = useMemo(
    () => ({ words, groups, loaded, refetchWords, refetchGroups, refetchAll }),
    [words, groups, loaded, refetchWords, refetchGroups, refetchAll]
  )

  return (
    <EnglishContext.Provider value={value}>
      {children}
    </EnglishContext.Provider>
  )
}

export function useEnglishStudy() {
  const ctx = useContext(EnglishContext)
  if (!ctx) throw new Error('useEnglishStudy must be used within EnglishProvider')
  return ctx
}
