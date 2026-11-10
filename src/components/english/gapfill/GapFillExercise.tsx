"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, RotateCcw, Send } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { cn } from "@/src/utils/ui";
import { WORD_LIMITS } from "@/src/lib/gapfill-word-limit";
import type { GapFillAnswer, GapFillAttempt, GapFillExercise } from "@/src/declaration/english";

interface Props {
  id: number;
  onBack: () => void;
  onChanged: () => void;
}

export function GapFillExerciseView({ id, onBack, onChanged }: Props) {
  const t = useTranslations("English.GapFill");
  const [exercise, setExercise] = useState<GapFillExercise | null>(null);
  const [answers, setAnswers] = useState<GapFillAnswer[] | null>(null);
  const [attempts, setAttempts] = useState<GapFillAttempt[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<GapFillAttempt | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const exitResult = useCallback(() => {
    setActiveAttempt(null);
    setShowAnswers(false);
  }, []);

  const resetPractice = useCallback((blankCount: number) => {
    setResponses(Array(blankCount).fill(""));
    exitResult();
  }, [exitResult]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/english/gapfill/${id}`);
      if (!res.ok) return;
      const data = ((await res.json()) as { exercise: GapFillExercise }).exercise;
      setExercise(data);
      setAnswers(data.answers);
      setAttempts(data.attempts);
      resetPractice(data.blankCount);
    })();
  }, [id, resetPractice]);

  const parts = useMemo(() => exercise?.content.split(/\{\{(\d+)\}\}/) ?? [], [exercise]);

  async function submit() {
    if (submitting || !exercise) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/english/gapfill/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { attempt: GapFillAttempt; answers: GapFillAnswer[] };
      setAnswers(data.answers);
      setAttempts((list) => [...list, data.attempt]);
      setActiveAttempt(data.attempt);
      setResponses(data.attempt.responses);
      onChanged();
    } catch {
      toast.error(t("submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  function viewAttempt(attempt: GapFillAttempt) {
    setActiveAttempt(attempt);
    setResponses(attempt.responses);
  }

  if (!exercise) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  const submitted = activeAttempt !== null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="link" className="h-auto p-0" onClick={onBack}>{t("back")}</Button>
        <h2 className="text-lg font-semibold">{exercise.title}</h2>
        <p className="text-sm">
          {t("wordLimit")}: {WORD_LIMITS[exercise.wordLimit].instruction}
        </p>
      </div>

      <div className="whitespace-pre-wrap rounded-lg border p-4 leading-[3]">
        {parts.map((part, i) => {
          if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
          const index = Number(part) - 1;
          const result = activeAttempt?.results[index];
          const answer = answers?.[index];
          return (
            <span key={i} className="inline-flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-xs font-semibold text-muted-foreground">({index + 1})</span>
              <input
                value={responses[index] ?? ""}
                onChange={(e) => setResponses((r) => r.map((v, j) => (j === index ? e.target.value : v)))}
                onFocus={() => { if (submitted) exitResult(); }}
                className={cn(
                  "h-8 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  exercise.wordLimit === "three" ? "w-44" : "w-36",
                  result === true && "border-green-500 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300",
                  result === false && "border-red-500 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                )}
              />
              {showAnswers && answer && (
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  {[answer.answer, ...answer.alternatives].join(" / ")}
                </span>
              )}
            </span>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {submitted ? (
          <>
            <span className="font-semibold">{t("score", { score: activeAttempt.score, total: activeAttempt.total })}</span>
            <Button variant="outline" onClick={() => setShowAnswers((v) => !v)}>
              {showAnswers ? <EyeOff /> : <Eye />}
              {showAnswers ? t("hideAnswers") : t("showAnswers")}
            </Button>
            <Button variant="outline" onClick={() => resetPractice(exercise.blankCount)}>
              <RotateCcw />
              {t("retry")}
            </Button>
          </>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Send />}
            {submitting ? t("submitting") : t("submit")}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">{t("history")}</h3>
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noAttempts")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {attempts.map((a, i) => (
              <Button
                key={a.id}
                size="sm"
                variant={activeAttempt?.id === a.id ? "default" : "outline"}
                onClick={() => viewAttempt(a)}
              >
                {t("attemptLabel", { n: i + 1, score: a.score, total: a.total })}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
