"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/src/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/Dialog";
import { Settings, Ticket } from "lucide-react";
import type { FlashcardCard } from "@/src/declaration/english";
import { useFlashcardSettings } from "./useFlashcardSettings";
import { FlashcardSettingsTab } from "./FlashcardSettingsTab";
import { usePronounce } from "../study/PronounceButton";
import { getCrawlAudioUrl } from "../study/crawlData";
import { FlashcardCard as FlashcardCardView, FlashcardProgress } from "../shared/FlashcardCard";
import { useEnglishStudy } from "@/src/context/english";

type Phase = "loading" | "empty" | "front" | "back" | "done";

interface GradeSummary {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

function SummaryScreen({ summary, onRestart }: { summary: GradeSummary; onRestart: () => void }) {
  const t = useTranslations("English");
  const total = summary.again + summary.hard + summary.good + summary.easy;
  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <p className="text-2xl font-semibold px-4 text-center">{t("Review.done", { count: total })}</p>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 sm:gap-6 text-sm px-4">
        <span className="text-red-500">{t("Review.summaryAgain", { count: summary.again })}</span>
        <span className="text-orange-500">{t("Review.summaryHard", { count: summary.hard })}</span>
        <span className="text-green-600">{t("Review.summaryGood", { count: summary.good })}</span>
        <span className="text-blue-500">{t("Review.summaryEasy", { count: summary.easy })}</span>
      </div>
      <Button onClick={onRestart} variant="outline">{t("Review.restart")}</Button>
    </div>
  );
}

export function FlashcardTab() {
  const t = useTranslations("English");
  const { settings, updateSettings, loaded: settingsLoaded } = useFlashcardSettings();
  const [phase, setPhase] = useState<Phase>("loading");
  const [dueQueue, setDueQueue] = useState<FlashcardCard[]>([]);
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState<GradeSummary>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [doneSummary, setDoneSummary] = useState<GradeSummary | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ticketToast, setTicketToast] = useState(false);
  const { words } = useEnglishStudy();
  const { pronounce } = usePronounce();

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

  useEffect(() => { if (settingsLoaded) void loadSession(); }, [loadSession, settingsLoaded]);

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

  useEffect(() => {
    if ((phase !== "front" && phase !== "back") || settingsOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (/^[1-4]$/.test(e.key)) grade((Number(e.key) - 1) as 0 | 1 | 2 | 3);
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Enter") setPhase((p) => (p === "front" ? "back" : "front"));
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const current = queue[index];
  const currentWord = current ? words.find((w) => w.id === current.wordId) : undefined;
  const audioUrl = currentWord ? getCrawlAudioUrl(currentWord) : undefined;

  useEffect(() => {
    if (settings.autoPronounce && phase === "front" && current) pronounce(current.word, audioUrl);
  }, [index, dueQueue]);

  const modeToggle = (
    <div className="w-full max-w-2xl mx-auto mb-4 space-y-2 px-4 sm:px-0">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-3.5 w-3.5" />
          {t("Review.settings")}
        </Button>
      </div>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Review.settingsTitle")}</DialogTitle>
          </DialogHeader>
          <FlashcardSettingsTab settings={settings} onChange={updateSettings} />
        </DialogContent>
      </Dialog>
    </div>
  );

  if (phase === "loading") {
    return (
      <div>
        {modeToggle}
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">{t("Common.loading")}</div>
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <div>
        {modeToggle}
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <p className="text-lg font-medium">{t("Review.noDue")}</p>
          <p className="text-sm">{t("Review.noDueHint")}</p>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    if (doneSummary) return <SummaryScreen summary={doneSummary} onRestart={loadSession} />;
  }

  if (!current) return null;

  const flipCard = () => setPhase(phase === "front" ? "back" : "front");

  return (
    <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto py-8 px-4 relative">
      {ticketToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 rounded-full shadow-lg animate-in fade-in slide-in-from-top-2">
          <Ticket className="h-4 w-4" />
          {t("Review.plusTicket")}
        </div>
      )}
      {modeToggle}
      <FlashcardProgress index={index} total={queue.length} />

      <FlashcardCardView
        word={current.word}
        senses={current.senses}
        flipped={phase === "back"}
        onFlip={flipCard}
        audioUrl={audioUrl}
        relatedWords={currentWord?.relatedWords}
        allWords={words}
      />

      {(phase === "front" || phase === "back") && (
        <div className="grid grid-cols-4 gap-2 w-full">
          <Button onClick={() => grade(0)} className="bg-red-500 hover:bg-red-600 text-white text-xs py-3 h-auto">
            <span className="font-semibold">{t("Review.again")}</span>
          </Button>
          <Button onClick={() => grade(1)} className="bg-orange-500 hover:bg-orange-600 text-white text-xs py-3 h-auto">
            <span className="font-semibold">{t("Review.hard")}</span>
          </Button>
          <Button onClick={() => grade(2)} className="bg-green-600 hover:bg-green-700 text-white text-xs py-3 h-auto">
            <span className="font-semibold">{t("Review.good")}</span>
          </Button>
          <Button onClick={() => grade(3)} className="bg-blue-500 hover:bg-blue-600 text-white text-xs py-3 h-auto">
            <span className="font-semibold">{t("Review.easy")}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
