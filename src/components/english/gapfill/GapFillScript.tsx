"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { DEFAULT_WORD_LIMIT, WORD_LIMITS, type WordLimit } from "@/src/lib/gapfill-word-limit";
import { InlineEdit, SourceText, WordLimitSelect, generateExercise } from "@/src/components/english/gapfill/shared";
import type { GapFillScript } from "@/src/declaration/english";

interface Props {
  id: number;
  onBack: () => void;
  onOpenExercise: (exerciseId: number) => void;
}

export function GapFillScriptView({ id, onBack, onOpenExercise }: Props) {
  const t = useTranslations("English.GapFill");
  const [script, setScript] = useState<GapFillScript | null>(null);
  const [showScript, setShowScript] = useState(false);
  const [wordLimit, setWordLimit] = useState<WordLimit>(DEFAULT_WORD_LIMIT);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/english/gapfill/scripts/${id}`);
    if (res.ok) setScript(((await res.json()) as { script: GapFillScript }).script);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function saveField(field: "name" | "source", value: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/english/gapfill/scripts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
      const saved = (await res.json()) as Partial<Pick<GapFillScript, "name" | "source">>;
      setScript((s) => (s ? { ...s, ...saved } : s));
      return true;
    } catch {
      toast.error(t("saveFailed"));
      return false;
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
        <InlineEdit value={script.name} editLabel={t("editName")} required onSave={(v) => saveField("name", v)}>
          <h2 className="truncate text-lg font-semibold">{script.name ?? t("script")}</h2>
        </InlineEdit>
        <InlineEdit value={script.source} placeholder={t("sourcePlaceholder")} editLabel={t("editSource")} onSave={(v) => saveField("source", v)}>
          <p className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
            <span className="shrink-0">{t("source")}:</span>
            <SourceText source={script.source} />
          </p>
        </InlineEdit>
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
