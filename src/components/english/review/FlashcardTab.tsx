"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/src/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/Dialog";
import { Settings, Ticket } from "lucide-react";
import type { FlashcardCard } from "@/src/declaration/english";
import { useFlashcardSettings } from "./useFlashcardSettings";
import { FlashcardSettingsTab } from "./FlashcardSettingsTab";
import { PronounceButton } from "../study/PronounceButton";

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
      <p className="text-2xl font-semibold px-4 text-center">Xong! {total} thẻ đã ôn</p>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 sm:gap-6 text-sm px-4">
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
  const [dueQueue, setDueQueue] = useState<FlashcardCard[]>([]);
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState<GradeSummary>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [doneSummary, setDoneSummary] = useState<GradeSummary | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ticketToast, setTicketToast] = useState(false);

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
      setDueQueue(data.cards);
      setPhase(data.cards.length === 0 ? "empty" : "front");
    } catch {
      setPhase("empty");
    }
  }, [settings.maxReviews, settings.order]);

  useEffect(() => { void loadSession(); }, [loadSession]);

  const queue = dueQueue;

  function persistGrade(wordId: number, g: 0 | 1 | 2 | 3) {
    fetch("/api/english/flashcard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId, grade: g }),
      keepalive: true,
    })
      .then((res) => res.json())
      .then((data: { ticketAwarded?: boolean }) => {
        if (data.ticketAwarded) {
          setTicketToast(true);
          setTimeout(() => setTicketToast(false), 1800);
        }
      })
      .catch(() => {});
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

  const modeToggle = (
    <div className="w-full max-w-md mx-auto mb-4 space-y-2 px-4 sm:px-0">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-3.5 w-3.5" />
          Cài đặt
        </Button>
      </div>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cài đặt ôn tập</DialogTitle>
          </DialogHeader>
          <FlashcardSettingsTab />
        </DialogContent>
      </Dialog>
    </div>
  );

  if (phase === "loading") {
    return (
      <div>
        {modeToggle}
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">Đang tải...</div>
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <div>
        {modeToggle}
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <p className="text-lg font-medium">Không có thẻ đến hạn hôm nay</p>
          <p className="text-sm">Thêm từ mới hoặc quay lại vào ngày mai.</p>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    if (doneSummary) return <SummaryScreen summary={doneSummary} onRestart={loadSession} />;
  }

  if (!current) return null;

  const first = current.senses[0];
  const flipCard = () => setPhase(phase === "front" ? "back" : "front");

  return (
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto py-8 px-4 relative">
      {ticketToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 rounded-full shadow-lg animate-in fade-in slide-in-from-top-2">
          <Ticket className="h-4 w-4" />
          +1 vé Gacha!
        </div>
      )}
      {modeToggle}
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
            <div className="flex items-center gap-2">
              <span className="text-4xl font-semibold text-center">{current.word}</span>
              <PronounceButton word={current.word} size="md" />
            </div>
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
