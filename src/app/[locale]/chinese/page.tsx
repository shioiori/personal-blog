'use client'

import { ChineseStudy } from '@/src/components/chinese/study/ChineseStudy'
import { ChineseSearch } from '@/src/components/chinese/search/ChineseSearch'
import { ReviewSection } from '@/src/components/chinese/review/ReviewSection'
import { ArchiveSection } from '@/src/components/chinese/archive/ArchiveSection'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/src/components/ui/Tabs'
import { PenLine, BookOpen, RotateCcw, Archive } from 'lucide-react'
import { ChineseProvider } from '@/src/context/chinese'

export default function Page() {
  return (
    <ChineseProvider>
      <Tabs defaultValue="study" className="space-y-6">
        <TabsList className="w-fit">
          <TabsTrigger value="study" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Học chữ
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Ôn tập
          </TabsTrigger>
          <TabsTrigger value="archive" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Ghi chép
          </TabsTrigger>
          <TabsTrigger value="draw" className="flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            Tra bằng nét vẽ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="study">
          <ChineseStudy />
        </TabsContent>

        <TabsContent value="review">
          <ReviewSection />
        </TabsContent>

        <TabsContent value="archive">
          <ArchiveSection />
        </TabsContent>

        <TabsContent value="draw">
          <ChineseSearch />
        </TabsContent>
      </Tabs>
    </ChineseProvider>
  )
}
