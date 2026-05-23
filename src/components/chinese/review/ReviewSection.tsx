"use client";

import { useState, useMemo, useEffect } from "react";
import { getAllCharacters } from "@/src/data/chinese";
import type { UserEdits } from "../study/EditCardModal";
import { ReviewTab } from "./ReviewTab";
import { FlashcardTab } from "./FlashcardTab";
import { HistoryTab } from "./HistoryTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/Tabs";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json() as Promise<T>;
}

export function ReviewSection() {
  const [userEdits, setUserEdits] = useState<Record<string, UserEdits>>({});
  const [hiddenCards, setHiddenCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      apiGet<Record<string, boolean>>("/api/chinese/state"),
      apiGet<Record<string, UserEdits>>("/api/chinese/edits"),
    ]).then(([states, edits]) => {
      const hidden = new Set(Object.entries(states).filter(([, v]) => v).map(([k]) => k));
      setHiddenCards(hidden);
      setUserEdits(edits);
    }).catch(() => {});
  }, []);

  const allChars = useMemo(() => getAllCharacters(), []);

  return (
    <Tabs defaultValue="read" className="space-y-6">
      <TabsList className="w-fit">
        <TabsTrigger value="read">Tập đọc</TabsTrigger>
        <TabsTrigger value="flashcard">Flashcard</TabsTrigger>
        <TabsTrigger value="history">Lịch sử</TabsTrigger>
      </TabsList>

      <TabsContent value="read">
        <ReviewTab allChars={allChars} userEdits={userEdits} hiddenCards={hiddenCards} />
      </TabsContent>

      <TabsContent value="flashcard">
        <FlashcardTab allChars={allChars} userEdits={userEdits} hiddenCards={hiddenCards} />
      </TabsContent>

      <TabsContent value="history">
        <HistoryTab allChars={allChars} userEdits={userEdits} />
      </TabsContent>
    </Tabs>
  );
}
