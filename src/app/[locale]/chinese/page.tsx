"use client";

import { ChineseStudy } from "@/src/components/chinese/ChineseStudy";
import { ChineseSearch } from "@/src/components/chinese/ChineseSearch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/Tabs";
import { PenLine, BookOpen } from "lucide-react";

export default function Page() {
  return (
    <Tabs defaultValue="study" className="space-y-6">
      <TabsList className="w-fit">
        <TabsTrigger value="study" className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Học chữ
        </TabsTrigger>
        <TabsTrigger value="draw" className="flex items-center gap-2">
          <PenLine className="h-4 w-4" />
          Tra bằng nét vẽ
        </TabsTrigger>
      </TabsList>

      <TabsContent value="study">
        <ChineseStudy />
      </TabsContent>

      <TabsContent value="draw">
        <ChineseSearch />
      </TabsContent>
    </Tabs>
  );
}
