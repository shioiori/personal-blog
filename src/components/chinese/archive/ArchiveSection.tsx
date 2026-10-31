"use client";

import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/Tabs";

const CompoundTab = dynamic(() => import("./CompoundTab").then((m) => m.CompoundTab), {
  loading: () => (
    <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin" />
      <p className="text-sm">Đang tải...</p>
    </div>
  ),
});

const GrammarTab = dynamic(() => import("./GrammarTab").then((m) => m.GrammarTab), {
  loading: () => (
    <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin" />
      <p className="text-sm">Đang tải...</p>
    </div>
  ),
});

const GroupCharTab = dynamic(() => import("./GroupCharTab").then((m) => m.GroupCharTab), {
  loading: () => (
    <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin" />
      <p className="text-sm">Đang tải...</p>
    </div>
  ),
});

export function ArchiveSection() {
  return (
    <Tabs defaultValue="compound" className="space-y-6">
      <TabsList className="w-full overflow-x-auto no-scrollbar flex-nowrap justify-start">
        <TabsTrigger value="compound" className="shrink-0">Từ theo danh mục</TabsTrigger>
        <TabsTrigger value="groupchar" className="shrink-0">Từ cùng hình thái</TabsTrigger>
        <TabsTrigger value="grammar" className="shrink-0">Ngữ pháp</TabsTrigger>
      </TabsList>

      <TabsContent value="compound">
        <CompoundTab />
      </TabsContent>

      <TabsContent value="grammar">
        <GrammarTab />
      </TabsContent>

      <TabsContent value="groupchar">
        <GroupCharTab />
      </TabsContent>
    </Tabs>
  );
}
