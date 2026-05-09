"use client";

import { useState, useEffect, useCallback } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/Tabs";
import { useSpeech } from "@/src/hooks/useSpeech";
import { FlashcardWriteTab } from "./FlashcardWriteTab";
import { FlashcardSettingsTab } from "./FlashcardSettingsTab";
import { useFlashcardSettings } from "@/src/hooks/useFlashcardSettings";
import type { CharacterInfo } from "@/src/data/chinese";
import type { UserEdits } from "@/src/declaration/chinese";

interface FlashcardTabProps {
  allChars: CharacterInfo[];
  userEdits: Record<string, UserEdits>;
  hiddenCards: Set<string>;
}

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

export function FlashcardTab({ allChars, userEdits }: FlashcardTabProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState<GradeSummary>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [doneSummary, setDoneSummary] = useState<GradeSummary | null>(null);

  const { settings, updateSettings } = useFlashcardSettings();

  const charMap = Object.fromEntries(allChars.map((c) => [c.char, c]));

  const loadSession = useCallback(async () => {
    setPhase("loading");
    setSummary({ again: 0, hard: 0, good: 0, easy: 0 });
    setDoneSummary(null);
    setIndex(0);
    try {
      const params = new URLSearchParams({ mode: "flip" });
      if (settings.maxReviews > 0) params.set("limit", String(settings.maxReviews));
      if (settings.order === "random") params.set("order", "random");
      const res = await fetch(`/api/chinese/flashcard?${params.toString()}`);
      const data = await res.json() as { cards: string[] };
      if (data.cards.length === 0) {
        setPhase("empty");
      } else {
        setQueue(data.cards);
        setPhase("front");
      }
    } catch {
      setPhase("empty");
    }
  }, [settings.maxReviews, settings.order]);

  useEffect(() => { void loadSession(); }, [loadSession]);

  async function grade(g: 0 | 1 | 2 | 3) {
    const char = queue[index];
    const gradeKey = (["again", "hard", "good", "easy"] as const)[g];
    const nextSummary = { ...summary, [gradeKey]: summary[gradeKey] + 1 };
    setSummary(nextSummary);

    await fetch("/api/chinese/flashcard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ char, grade: g, mode: "flip" }),
    }).catch(() => {});

    const next = index + 1;
    if (next >= queue.length) {
      setDoneSummary(nextSummary);
      setPhase("done");
    } else {
      setIndex(next);
      setPhase("front");
    }
  }

  const { speak } = useSpeech();
  const current = queue[index];
  const info = current ? charMap[current] : null;
  const edits = current ? userEdits[current] : undefined;

  const pinyin = edits?.pinyin ?? info?.pinyin ?? "";
  const hanViet = edits?.hanViet ?? info?.hanViet ?? "";
  const meaningVi = edits?.meaningVi ?? info?.meaningVi ?? info?.meaning ?? "";
  const note = edits?.note ?? "";

  function getFrontContent() {
    if (settings.frontSide === "pinyin") return pinyin || current;
    if (settings.frontSide === "meaning") return meaningVi || hanViet || current;
    return current;
  }

  function getBackContent() {
    if (settings.frontSide === "char") {
      return (
        <div className="flex flex-col items-center gap-2 text-center border-t pt-4 w-full">
          {pinyin && <p className="text-xl text-muted-foreground">{pinyin}</p>}
          {hanViet && <p className="text-base font-medium">{hanViet}</p>}
          {meaningVi && <p className="text-base">{meaningVi}</p>}
          {note && <p className="text-sm text-muted-foreground italic mt-1">{note}</p>}
        </div>
      );
    }
    if (settings.frontSide === "pinyin") {
      return (
        <div className="flex flex-col items-center gap-2 text-center border-t pt-4 w-full">
          <span className="text-6xl font-light">{current}</span>
          {hanViet && <p className="text-base font-medium">{hanViet}</p>}
          {meaningVi && <p className="text-base">{meaningVi}</p>}
          {note && <p className="text-sm text-muted-foreground italic mt-1">{note}</p>}
        </div>
      );
    }
    // frontSide === "meaning"
    return (
      <div className="flex flex-col items-center gap-2 text-center border-t pt-4 w-full">
        <span className="text-6xl font-light">{current}</span>
        {pinyin && <p className="text-xl text-muted-foreground">{pinyin}</p>}
        {hanViet && <p className="text-base font-medium">{hanViet}</p>}
        {note && <p className="text-sm text-muted-foreground italic mt-1">{note}</p>}
      </div>
    );
  }

  const frontDisplay = getFrontContent();
  const isCharFront = settings.frontSide === "char";

  const FlipCardContent = () => {
    if (phase === "loading") {
      return (
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
          Đang tải...
        </div>
      );
    }

    if (phase === "empty") {
      return (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <p className="text-lg font-medium">Không có thẻ đến hạn hôm nay</p>
          <p className="text-sm">Đánh dấu thêm chữ là &quot;đã học&quot; hoặc quay lại vào ngày mai.</p>
        </div>
      );
    }

    if (phase === "done" && doneSummary) {
      return <SummaryScreen summary={doneSummary} onRestart={loadSession} />;
    }

    const flipCard = () => {
      if (phase === "front") setPhase("back");
      else if (phase === "back") setPhase("front");
    };

    return (
      <div className="flex flex-col items-center gap-6 max-w-md mx-auto py-8">
        <div className="w-full flex items-center justify-between text-sm text-muted-foreground">
          <span>{index + 1} / {queue.length}</span>
          <div className="h-2 flex-1 mx-4 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
          </div>
        </div>

        <div
          className="w-full cursor-pointer select-none"
          style={{ perspective: "1000px", minHeight: "16rem" }}
          onClick={flipCard}
        >
          <div
            style={{
              transformStyle: "preserve-3d",
              transition: "transform 0.5s ease",
              transform: phase === "back" ? "rotateY(180deg)" : "rotateY(0deg)",
              position: "relative",
              minHeight: "16rem",
            }}
          >
            {/* front */}
            <div
              className="absolute inset-0 border rounded-2xl p-8 flex flex-col items-center justify-center gap-4 shadow-sm bg-background"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="flex items-center gap-3">
                {isCharFront ? (
                  <>
                    <span className="text-8xl font-light">{frontDisplay}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); speak(current); }}
                      className="text-muted-foreground/40 hover:text-primary transition-colors self-start mt-2"
                      title="Phát âm"
                    >
                      <Volume2 className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <span className="text-2xl font-medium text-center">{frontDisplay}</span>
                )}
              </div>
              {settings.showPinyinOnFront && isCharFront && pinyin && (
                <p className="text-sm text-muted-foreground/60">{pinyin}</p>
              )}
              <p className="text-xs text-muted-foreground mt-auto">Nhấn để lật thẻ</p>
            </div>

            {/* back */}
            <div
              className="absolute inset-0 border rounded-2xl p-8 flex flex-col items-center justify-center gap-4 shadow-sm bg-background"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <div className="flex items-center gap-3">
                {isCharFront ? (
                  <>
                    <span className="text-8xl font-light">{current}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); speak(current); }}
                      className="text-muted-foreground/40 hover:text-primary transition-colors self-start mt-2"
                      title="Phát âm"
                    >
                      <Volume2 className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); speak(current); }}
                    className="text-muted-foreground/40 hover:text-primary transition-colors"
                    title="Phát âm"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                )}
              </div>
              {getBackContent()}
            </div>
          </div>
        </div>

        {(phase === "front" || phase === "back") && (
          <div className="grid grid-cols-4 gap-2 w-full">
            <Button onClick={() => grade(0)} className="bg-red-500 hover:bg-red-600 text-white text-xs py-3 h-auto">
              <span className="font-semibold">Không nhớ</span>
            </Button>
            <Button onClick={() => grade(1)} className="bg-orange-500 hover:bg-orange-600 text-white text-xs py-3 h-auto">
              <span className="font-semibold">Khó</span>
            </Button>
            <Button onClick={() => grade(2)} className="bg-green-600 hover:bg-green-700 text-white text-xs py-3 h-auto">
              <span className="font-semibold">Nhớ</span>
            </Button>
            <Button onClick={() => grade(3)} className="bg-blue-500 hover:bg-blue-600 text-white text-xs py-3 h-auto">
              <span className="font-semibold">Dễ</span>
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Tabs defaultValue="flip" className="space-y-4">
      <TabsList className="w-fit">
        <TabsTrigger value="flip">Lật thẻ</TabsTrigger>
        <TabsTrigger value="write">Viết chữ</TabsTrigger>
        <TabsTrigger value="settings">Cài đặt</TabsTrigger>
      </TabsList>

      <TabsContent value="flip">
        <FlipCardContent />
      </TabsContent>

      <TabsContent value="write">
        <FlashcardWriteTab
          allChars={allChars}
          userEdits={userEdits}
        />
      </TabsContent>

      <TabsContent value="settings">
        <FlashcardSettingsTab settings={settings} onChange={updateSettings} />
      </TabsContent>
    </Tabs>
  );
}
