'use client'

import { WordList } from '@/src/components/english/study/WordList'
import { ImportTab } from '@/src/components/english/study/ImportTab'
import { FlashcardTab } from '@/src/components/english/review/FlashcardTab'
import { RefreshDataButton } from '@/src/components/english/shared/RefreshDataButton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/src/components/ui/Tabs'
import { GapFillTab } from '@/src/components/english/gapfill/GapFillTab'
import { BookOpen, RotateCcw, Upload, PenLine } from 'lucide-react'
import { EnglishProvider } from '@/src/context/english'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

const TABS = ['study', 'review', 'import', 'gacha', 'gapfill']

export default function Page() {
  const t = useTranslations('English.Tabs')
  const [tab, setTab] = useState('study')

  useEffect(() => {
    const fromHash = window.location.hash.slice(1)
    if (TABS.includes(fromHash)) setTab(fromHash)
  }, [])

  function changeTab(value: string) {
    setTab(value)
    window.history.replaceState(null, '', `#${value}`)
  }

  return (
    <EnglishProvider>
      <Tabs value={tab} onValueChange={changeTab} className="space-y-6">
        <div className="flex items-center justify-between gap-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="overflow-x-auto no-scrollbar">
          <TabsList className="w-max sm:w-fit">
            <TabsTrigger value="study" className="flex items-center gap-2 whitespace-nowrap">
              <BookOpen className="h-4 w-4" />
              {t('study')}
            </TabsTrigger>
            <TabsTrigger value="review" className="flex items-center gap-2 whitespace-nowrap">
              <RotateCcw className="h-4 w-4" />
              {t('review')}
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2 whitespace-nowrap">
              <Upload className="h-4 w-4" />
              {t('import')}
            </TabsTrigger>
            <TabsTrigger value="gapfill" className="flex items-center gap-2 whitespace-nowrap">
              <PenLine className="h-4 w-4" />
              {t('gapfill')}
            </TabsTrigger>
          </TabsList>
          </div>
          <RefreshDataButton />
        </div>

        <TabsContent value="study">
          <WordList />
        </TabsContent>

        <TabsContent value="review">
          <FlashcardTab />
        </TabsContent>

        <TabsContent value="import">
          <ImportTab />
        </TabsContent>

        <TabsContent value="gapfill">
          <GapFillTab />
        </TabsContent>
      </Tabs>
    </EnglishProvider>
  )
}
