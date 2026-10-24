"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/src/components/ui/Button";
import type { FlashcardCard } from "@/src/declaration/english";
import { useFlashcardSettings } from "./useFlashcardSettings";

type Phase = "loading" | "empty" | "front" | "back" | "done";

interface GradeSummary {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

function SummaryScreen({ summary, onRestart }: { summary: GradeSummary; onRestart: () => void }) {
  const total = summary.again + summary.hard + summary.good + summary.easy;
  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <p className="text-2xl font-semibold">Xong! {total} thẻ đã ôn</p>
      <div className="flex gap-6 text-sm">
        <span className="text-red-500">Không nhớ: {summary.again}</span>
        <span className="text-orange-500">Khó: {summary.hard}</span>
        <span className="text-green-600">Nhớ: {summary.good}</span>
        <span className="text-blue-500">Dễ: {summary.easy}</span>
      </div>
      <Button onClick={onRestart} variant="outline">Ôn lại từ đầu</Button>
    </div>
  );
}

export function FlashcardTab() {
  const { settings } = useFlashcardSettings();
  const [phase, setPhase] = useState<Phase>("loading");
  const [queue, setQueue] = useState<FlashcardCard[]>([]);
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState<GradeSummary>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [doneSummary, setDoneSummary] = useState<GradeSummary | null>(null);

  const loadSession = useCallback(async () => {
    setPhase("loading");
    setSummary({ again: 0, hard: 0, good: 0, easy: 0 });
    setDoneSummary(null);
    setIndex(0);
    try {
      const params = new URLSearchParams();
      if (settings.maxReviews > 0) params.set("limit", String(settings.maxReviews));
      if (settings.order === "random") params.set("order", "random");
      const res = await fetch(`/api/english/flashcard?${params.toString()}`);
      const data = (await res.json()) as { cards: FlashcardCard[] };
      if (data.cards.length === 0) setPhase("empty");
      else {
        setQueue(data.cards);
        setPhase("front");
      }
    } catch {
      setPhase("empty");
    }
  }, [settings.maxReviews, settings.order]);

  useEffect(() => { void loadSession(); }, [loadSession]);

  function persistGrade(wordId: number, g: 0 | 1 | 2 | 3) {
    void fetch("/api/english/flashcard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId, grade: g }),
      keepalive: true,
    }).catch(() => {});
  }

  function grade(g: 0 | 1 | 2 | 3) {
    const card = queue[index];
    if (!card) return;
    const gradeKey = (["again", "hard", "good", "easy"] as const)[g];
    const nextSummary = { ...summary, [gradeKey]: summary[gradeKey] + 1 };
    setSummary(nextSummary);

    const next = index + 1;
    if (next >= queue.length) {
      setDoneSummary(nextSummary);
      setPhase("done");
    } else {
      setIndex(next);
      setPhase("front");
    }
    persistGrade(card.wordId, g);
  }

  const current = queue[index];

  if (phase === "loading") {
    return <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">Đang tải...</div>;
  }

  if (phase === "empty") {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <p className="text-lg font-medium">Không có thẻ đến hạn hôm nay</p>
        <p className="text-sm">Thêm từ mới hoặc quay lại vào ngày mai.</p>
      </div>
    );
  }

  if (phase === "done" && doneSummary) {
    return <SummaryScreen summary={doneSummary} onRestart={loadSession} />;
  }

  if (!current) return null;

  const first = current.senses[0];
  const flipCard = () => setPhase(phase === "front" ? "back" : "front");

  return (
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto py-8">
      <div className="w-full flex items-center justify-between text-sm text-muted-foreground">
        <span>{index + 1} / {queue.length}</span>
        <div className="h-2 flex-1 mx-4 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
        </div>
      </div>

      <div className="w-full cursor-pointer select-none" style={{ perspective: "1000px", minHeight: "16rem" }} onClick={flipCard}>
        <div
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.5s ease",
            transform: phase === "back" ? "rotateY(180deg)" : "rotateY(0deg)",
            position: "relative",
            minHeight: "16rem",
          }}
        >
          <div className="absolute inset-0 border rounded-2xl p-8 flex flex-col items-center justify-center gap-4 shadow-sm bg-background" style={{ backfaceVisibility: "hidden" }}>
            <span className="text-4xl font-semibold text-center">{current.word}</span>
            {first?.phonetic && <p className="text-base text-muted-foreground">/{first.phonetic}/</p>}
            {first?.partOfSpeech && (
              <span className="inline-block px-2 py-0.5 rounded bg-muted text-xs font-medium uppercase text-muted-foreground">
                {first.partOfSpeech}
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-auto">Nhấn để lật thẻ</p>
          </div>

          <div className="absolute inset-0 border rounded-2xl p-8 flex flex-col items-center gap-3 shadow-sm bg-background overflow-y-auto" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <span className="text-2xl font-semibold text-center">{current.word}</span>
            {current.senses.map((s, i) => (
              <div key={i} className="w-full text-center text-sm space-y-1 border-t border-border/50 pt-2 first:border-0 first:pt-0">
                {s.partOfSpeech && <span className="text-xs text-muted-foreground uppercase font-medium">{s.partOfSpeech}</span>}
                {s.meaningVi && <p className="font-medium">{s.meaningVi}</p>}
                {s.cambridgeMeaning && <p className="text-muted-foreground italic">{s.cambridgeMeaning}</p>}
                {s.example && <p className="text-xs text-muted-foreground">&quot;{s.example}&quot;</p>}
                {(s.synonyms || s.antonyms) && (
                  <p className="text-xs text-muted-foreground">
                    {s.synonyms && <>Đồng nghĩa: {s.synonyms} </>}
                    {s.antonyms && <>Trái nghĩa: {s.antonyms}</>}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {(phase === "front" || phase === "back") && (
        <div className="grid grid-cols-4 gap-2 w-full">
          <Button onClick={() => grade(0)} className="bg-red-500 hover:bg-red-600 text-white text-xs py-3 h-auto">
            <span className="font-semibold">Lại</span>
          </Button>
          <Button onClick={() => grade(1)} className="bg-orange-500 hover:bg-orange-600 text-white text-xs py-3 h-auto">
            <span className="font-semibold">Khó</span>
          </Button>
          <Button onClick={() => grade(2)} className="bg-green-600 hover:bg-green-700 text-white text-xs py-3 h-auto">
            <span className="font-semibold">Tốt</span>
          </Button>
          <Button onClick={() => grade(3)} className="bg-blue-500 hover:bg-blue-600 text-white text-xs py-3 h-auto">
            <span className="font-semibold">Dễ</span>
          </Button>
        </div>
      )}
    </div>
  );
}
