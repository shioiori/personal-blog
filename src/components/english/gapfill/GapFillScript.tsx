"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, Pencil, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { DEFAULT_WORD_LIMIT, WORD_LIMITS, type WordLimit } from "@/src/lib/gapfill-word-limit";
import { SourceText, WordLimitSelect, generateExercise } from "@/src/components/english/gapfill/shared";
import type { GapFillScript } from "@/src/declaration/english";

interface Props {
  id: number;
  onBack: () => void;
  onOpenExercise: (exerciseId: number) => void;
}

export function GapFillScriptView({ id, onBack, onOpenExercise }: Props) {
  const t = useTranslations("English.GapFill");
  const tc = useTranslations("English.Common");
  const [script, setScript] = useState<GapFillScript | null>(null);
  const [sourceDraft, setSourceDraft] = useState<string | null>(null);
  const [savingSource, setSavingSource] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [wordLimit, setWordLimit] = useState<WordLimit>(DEFAULT_WORD_LIMIT);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/english/gapfill/scripts/${id}`);
    if (res.ok) setScript(((await res.json()) as { script: GapFillScript }).script);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function saveSource() {
    if (savingSource || sourceDraft === null) return;
    setSavingSource(true);
    try {
      const res = await fetch(`/api/english/gapfill/scripts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceDraft }),
      });
      if (!res.ok) throw new Error();
      const { source } = (await res.json()) as { source: string | null };
      setScript((s) => (s ? { ...s, source } : s));
      setSourceDraft(null);
    } catch {
      toast.error(t("sourceSaveFailed"));
    } finally {
      setSavingSource(false);
    }
  }

  async function generate() {
    if (generating) return;
    setGenerating(true);
    const result = await generateExercise({ scriptId: id, wordLimit }, t);
    setGenerating(false);
    if (result) onOpenExercise(result.id);
  }

  async function removeExercise(exerciseId: number) {
    if (!confirm(t("confirmDelete"))) return;
    await fetch(`/api/english/gapfill/${exerciseId}`, { method: "DELETE" });
    setScript((s) => (s ? { ...s, exercises: s.exercises.filter((e) => e.id !== exerciseId) } : s));
  }

  if (!script) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="link" className="h-auto p-0" onClick={onBack}>{t("back")}</Button>
        <h2 className="text-lg font-semibold">{t("script")}</h2>
        {sourceDraft !== null ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={sourceDraft}
              onChange={(e) => setSourceDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveSource();
                if (e.key === "Escape") setSourceDraft(null);
              }}
              placeholder={t("sourcePlaceholder")}
              maxLength={500}
              autoFocus
              className="h-9 max-w-md"
            />
            <Button size="sm" onClick={saveSource} disabled={savingSource}>
              {savingSource && <Loader2 className="animate-spin" />}
              {tc("save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSourceDraft(null)} disabled={savingSource}>
              {tc("cancel")}
            </Button>
          </div>
        ) : (
          <p className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
            <span className="shrink-0">{t("source")}:</span>
            <SourceText source={script.source} />
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSourceDraft(script.source ?? "")} aria-label={t("editSource")}>
              <Pencil />
            </Button>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Button variant="outline" size="sm" onClick={() => setShowScript((v) => !v)}>
          {showScript ? <ChevronUp /> : <ChevronDown />}
          {showScript ? t("hideScript") : t("showScript")}
        </Button>
        {showScript && (
          <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border p-4 text-sm">{script.transcript}</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <WordLimitSelect value={wordLimit} onChange={setWordLimit} disabled={generating} />
        <Button onClick={generate} disabled={generating}>
          {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {generating ? t("generating") : t("generateFromScript")}
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">{t("exercises")}</h3>
        {script.exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {script.exercises.map((e) => (
              <li key={e.id} className="flex items-center gap-2 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenExercise(e.id)}>
                  <div className="truncate font-medium hover:underline">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleDateString()} · {WORD_LIMITS[e.wordLimit].instruction} · {t("blanks", { count: e.blankCount })} ·{" "}
                    {e.attemptCount === 0
                      ? t("notAttempted")
                      : `${t("attempts", { count: e.attemptCount })} · ${t("bestScore", { score: e.bestScore ?? 0, total: e.blankCount })}`}
                  </div>
                </button>
                <Button variant="ghost" size="icon" onClick={() => removeExercise(e.id)} aria-label={t("delete")}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
