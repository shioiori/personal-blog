'use client'

import { WordList } from '@/src/components/english/study/WordList'
import { ImportTab } from '@/src/components/english/study/ImportTab'
import { FlashcardTab } from '@/src/components/english/review/FlashcardTab'
import { GachaTab } from '@/src/components/english/gacha/GachaTab'
import { RefreshDataButton } from '@/src/components/english/shared/RefreshDataButton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/src/components/ui/Tabs'
import { BookOpen, RotateCcw, Upload, Sparkles } from 'lucide-react'
import { EnglishProvider } from '@/src/context/english'
import { useTranslations } from 'next-intl'

export default function Page() {
  const t = useTranslations('English.Tabs')
  return (
    <EnglishProvider>
      <Tabs defaultValue="study" className="space-y-6">
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
            <TabsTrigger value="gacha" className="flex items-center gap-2 whitespace-nowrap">
              <Sparkles className="h-4 w-4" />
              {t('gacha')}
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

        <TabsContent value="gacha">
          <GachaTab />
        </TabsContent>
      </Tabs>
    </EnglishProvider>
  )
}
