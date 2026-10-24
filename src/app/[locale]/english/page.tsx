'use client'

import { WordList } from '@/src/components/english/study/WordList'
import { ImportTab } from '@/src/components/english/study/ImportTab'
import { GroupTab } from '@/src/components/english/groups/GroupTab'
import { FlashcardTab } from '@/src/components/english/review/FlashcardTab'
import { FlashcardSettingsTab } from '@/src/components/english/review/FlashcardSettingsTab'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/src/components/ui/Tabs'
import { BookOpen, RotateCcw, FolderOpen, Upload, Settings } from 'lucide-react'
import { EnglishProvider } from '@/src/context/english'

export default function Page() {
  return (
    <EnglishProvider>
      <Tabs defaultValue="study" className="space-y-6">
        <TabsList className="w-fit">
          <TabsTrigger value="study" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Học từ
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Nhóm từ
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Ôn tập
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Cài đặt ôn tập
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="study">
          <WordList />
        </TabsContent>

        <TabsContent value="groups">
          <GroupTab />
        </TabsContent>

        <TabsContent value="review">
          <FlashcardTab />
        </TabsContent>

        <TabsContent value="settings">
          <FlashcardSettingsTab />
        </TabsContent>

        <TabsContent value="import">
          <ImportTab />
        </TabsContent>
      </Tabs>
    </EnglishProvider>
  )
}
