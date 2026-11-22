"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/src/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/Dialog";
import { Check, Mic, Settings, Square, X } from "lucide-react";
import type { WritingCard, WritingCheckResult } from "@/src/declaration/english";
import { useWritingSettings } from "./useWritingSettings";
import { WritingSettingsTab } from "./WritingSettingsTab";
import { useVoiceInput } from "./useVoiceInput";
import { FlashcardProgress } from "../shared/FlashcardCard";

type Phase = "loading" | "needsPremium" | "empty" | "prompt" | "writing" | "checking" | "feedback" | "revealed" | "done";

interface GradeSummary {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

const GRADE_KEYS = ["again", "hard", "good", "easy"] as const;
const GRADE_COLORS = ["text-red-500", "text-orange-500", "text-green-600", "text-blue-500"] as const;

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

export function WritingTab() {
  const t = useTranslations("English");
  const { settings, updateSettings, loaded: settingsLoaded } = useWritingSettings();
  const [phase, setPhase] = useState<Phase>("loading");
  const [dueQueue, setDueQueue] = useState<WritingCard[]>([]);
  const [index, setIndex] = useState(0);
  const [sentence, setSentence] = useState("");
  const [result, setResult] = useState<WritingCheckResult | null>(null);
  const [summary, setSummary] = useState<GradeSummary>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [doneSummary, setDoneSummary] = useState<GradeSummary | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const voice = useVoiceInput();

  const loadSession = useCallback(async () => {
    setPhase("loading");
    setSummary({ again: 0, hard: 0, good: 0, easy: 0 });
    setDoneSummary(null);
    setIndex(0);
    try {
      const params = new URLSearchParams();
      if (settings.maxReviews > 0) params.set("limit", String(settings.maxReviews));
      if (settings.order === "random") params.set("order", "random");
      const res = await fetch(`/api/english/writing?${params.toString()}`);
      if (res.status === 403) {
        setPhase("needsPremium");
        return;
      }
      const data = (await res.json()) as { cards: WritingCard[] };
      setDueQueue(data.cards ?? []);
      setPhase((data.cards?.length ?? 0) === 0 ? "empty" : "prompt");
    } catch {
      setPhase("empty");
    }
  }, [settings.maxReviews, settings.order]);

  useEffect(() => { if (settingsLoaded) void loadSession(); }, [loadSession, settingsLoaded]);

  const queue = dueQueue;
  const current = queue[index];

  function recordSummary(g: 0 | 1 | 2 | 3) {
    const gradeKey = GRADE_KEYS[g];
    const next = { ...summary, [gradeKey]: summary[gradeKey] + 1 };
    setSummary(next);
    return next;
  }

  function advance(nextSummary: GradeSummary) {
    const next = index + 1;
    setSentence("");
    setResult(null);
    if (next >= queue.length) {
      setDoneSummary(nextSummary);
      setPhase("done");
    } else {
      setIndex(next);
      setPhase("prompt");
    }
  }

  function markForget() {
    const card = current;
    if (!card) return;
    const nextSummary = recordSummary(0);
    fetch("/api/english/writing/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId: card.wordId, grade: 0 }),
      keepalive: true,
    }).catch(() => {});
    setPhase("revealed");
    // Hold the grade summary until the user continues past the reveal.
    setDoneSummary(null);
    setSummary(nextSummary);
  }

  async function submitSentence() {
    const card = current;
    if (!card || !sentence.trim()) return;
    voice.stop();
    setPhase("checking");
    try {
      const res = await fetch("/api/english/writing/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: card.wordId, sentence: sentence.trim() }),
      });
      if (res.status === 403) {
        setPhase("needsPremium");
        return;
      }
      const data = (await res.json()) as WritingCheckResult;
      setResult(data);
      recordSummary(data.grade);
      setPhase("feedback");
    } catch {
      setPhase("writing");
    }
  }

  function continueAfterReveal() {
    advance(summary);
  }

  function continueAfterFeedback() {
    advance(summary);
  }

  function startVoice() {
    voice.start((text) => setSentence((prev) => (prev ? `${prev} ${text}` : text)));
  }

  const settingsDialog = (
    <div className="w-full max-w-2xl mx-auto mb-4 px-4 sm:px-0">
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
          <WritingSettingsTab settings={settings} onSave={(next) => { updateSettings(next); setSettingsOpen(false); }} />
        </DialogContent>
      </Dialog>
    </div>
  );

  if (phase === "loading") {
    return (
      <div>
        {settingsDialog}
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">{t("Common.loading")}</div>
      </div>
    );
  }

  if (phase === "needsPremium") {
    return (
      <div>
        {settingsDialog}
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground text-center px-4">
          <p className="text-lg font-medium">{t("Writing.needsPremium")}</p>
        </div>
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <div>
        {settingsDialog}
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <p className="text-lg font-medium">{t("Review.noDue")}</p>
          <p className="text-sm">{t("Writing.noDueHint")}</p>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    if (doneSummary) return <SummaryScreen summary={doneSummary} onRestart={loadSession} />;
  }

  if (!current) return null;

  return (
    <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto py-8 px-4 relative">
      {settingsDialog}
      <FlashcardProgress index={index} total={queue.length} />

      <div className="w-full border rounded-2xl p-6 sm:p-8 flex flex-col items-center gap-4 shadow-sm bg-background min-h-[14rem] justify-center">
        <p className="text-2xl sm:text-3xl font-semibold text-center">{current.meaningVi}</p>

        {phase === "prompt" && (
          <div className="flex gap-3 mt-4">
            <Button onClick={markForget} className="bg-red-500 hover:bg-red-600 text-white gap-2 px-6">
              <X className="h-4 w-4" />
              {t("Writing.dontRemember")}
            </Button>
            <Button onClick={() => setPhase("writing")} className="bg-green-600 hover:bg-green-700 text-white gap-2 px-6">
              <Check className="h-4 w-4" />
              {t("Writing.remember")}
            </Button>
          </div>
        )}

        {(phase === "writing" || phase === "checking") && (
          <div className="w-full flex flex-col gap-3 mt-2">
            <p className="text-sm text-muted-foreground text-center">{t("Writing.writeSentenceHint")}</p>
            {voice.supported && (
              <div className="flex justify-center">
                <div className="flex rounded-md border overflow-hidden text-xs">
                  <button
                    onClick={() => updateSettings({ inputMode: "type" })}
                    className={`px-3 py-1.5 transition-colors ${
                      settings.inputMode === "type" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t("Writing.inputModeType")}
                  </button>
                  <button
                    onClick={() => updateSettings({ inputMode: "voice" })}
                    className={`px-3 py-1.5 transition-colors ${
                      settings.inputMode === "voice" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t("Writing.inputModeVoice")}
                  </button>
                </div>
              </div>
            )}
            {settings.inputMode === "voice" && voice.supported ? (
              <div className="flex flex-col items-center gap-2">
                <textarea
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t("Writing.sentencePlaceholder")}
                  disabled={phase === "checking"}
                />
                <Button
                  type="button"
                  variant={voice.listening ? "destructive" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={voice.listening ? voice.stop : startVoice}
                  disabled={phase === "checking"}
                >
                  {voice.listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {voice.listening ? t("Writing.voiceListening") : t("Writing.voiceStart")}
                </Button>
              </div>
            ) : (
              <textarea
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder={t("Writing.sentencePlaceholder")}
                disabled={phase === "checking"}
                autoFocus
              />
            )}
            <Button onClick={submitSentence} disabled={!sentence.trim() || phase === "checking"}>
              {phase === "checking" ? t("Writing.checking") : t("Writing.submit")}
            </Button>
          </div>
        )}

        {phase === "feedback" && result && (
          <div className="w-full flex flex-col items-center gap-4 mt-2">
            <p className="text-sm italic text-muted-foreground text-center">&ldquo;{sentence}&rdquo;</p>
            <p className={`text-sm font-semibold ${GRADE_COLORS[result.grade]}`}>{t("Writing.aiGrade", { grade: String(result.grade) })}</p>
            {result.feedback ? (
              <p className="text-sm text-center bg-muted rounded-lg px-4 py-3">{result.feedback}</p>
            ) : (
              <p className="text-sm text-green-600 text-center">{t("Writing.perfectSentence")}</p>
            )}
            <Button onClick={continueAfterFeedback} variant="outline">{t("Writing.continue")}</Button>
          </div>
        )}

        {phase === "revealed" && (
          <div className="w-full flex flex-col items-center gap-3 mt-2">
            <p className="text-lg text-muted-foreground">{t("Writing.answerWas")}</p>
            <p className="text-3xl font-semibold">{current.word}</p>
            <Button onClick={continueAfterReveal} variant="outline">{t("Writing.continue")}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
