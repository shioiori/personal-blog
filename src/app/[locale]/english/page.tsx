'use client'

import { WordList } from '@/src/components/english/study/WordList'
import { ImportTab } from '@/src/components/english/study/ImportTab'
import { GroupTab } from '@/src/components/english/groups/GroupTab'
import { FlashcardTab } from '@/src/components/english/review/FlashcardTab'
import { GachaTab } from '@/src/components/english/gacha/GachaTab'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/src/components/ui/Tabs'
import { BookOpen, RotateCcw, FolderOpen, Upload, Sparkles } from 'lucide-react'
import { EnglishProvider } from '@/src/context/english'

export default function Page() {
  return (
    <EnglishProvider>
      <Tabs defaultValue="study" className="space-y-6">
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
          <TabsList className="w-max sm:w-fit">
            <TabsTrigger value="study" className="flex items-center gap-2 whitespace-nowrap">
              <BookOpen className="h-4 w-4" />
              Học từ
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2 whitespace-nowrap">
              <FolderOpen className="h-4 w-4" />
              Nhóm từ
            </TabsTrigger>
            <TabsTrigger value="review" className="flex items-center gap-2 whitespace-nowrap">
              <RotateCcw className="h-4 w-4" />
              Ôn tập
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2 whitespace-nowrap">
              <Upload className="h-4 w-4" />
              Import
            </TabsTrigger>
            <TabsTrigger value="gacha" className="flex items-center gap-2 whitespace-nowrap">
              <Sparkles className="h-4 w-4" />
              Gacha
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="study">
          <WordList />
        </TabsContent>

        <TabsContent value="groups">
          <GroupTab />
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
