"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Textarea } from "@/src/components/ui/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/Select";
import { DEFAULT_WORD_LIMIT, WORD_LIMITS, WORD_LIMIT_KEYS, type WordLimit } from "@/src/lib/gapfill-word-limit";
import { GapFillExerciseView } from "@/src/components/english/gapfill/GapFillExercise";
import type { GapFillExerciseSummary } from "@/src/declaration/english";

export function GapFillTab() {
  const t = useTranslations("English.GapFill");
  const [exercises, setExercises] = useState<GapFillExerciseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [wordLimit, setWordLimit] = useState<WordLimit>(DEFAULT_WORD_LIMIT);
  const [generating, setGenerating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/english/gapfill");
      if (res.ok) setExercises(((await res.json()) as { exercises: GapFillExerciseSummary[] }).exercises);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function generate() {
    if (generating || !input.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/english/gapfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, wordLimit }),
      });
      const data = (await res.json()) as { id?: number; needsPremium?: boolean; invalid?: boolean; tooLong?: boolean };
      if (!res.ok || !data.id) {
        toast.error(t(data.needsPremium ? "needsPremium" : data.invalid ? "invalidInput" : data.tooLong ? "tooLong" : "generateFailed"));
        return;
      }
      toast.success(t("generated"));
      setInput("");
      await load();
      setSelectedId(data.id);
    } catch {
      toast.error(t("generateFailed"));
    } finally {
      setGenerating(false);
    }
  }

  async function remove(id: number) {
    if (!confirm(t("confirmDelete"))) return;
    await fetch(`/api/english/gapfill/${id}`, { method: "DELETE" });
    setExercises((list) => list.filter((e) => e.id !== id));
  }

  if (selectedId !== null) {
    return <GapFillExerciseView id={selectedId} onBack={() => setSelectedId(null)} onChanged={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("inputLabel")}</label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("inputPlaceholder")}
          className="min-h-48 max-h-[50vh]"
          disabled={generating}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={wordLimit} onValueChange={(v) => setWordLimit(v as WordLimit)} disabled={generating}>
            <SelectTrigger className="w-auto max-w-full" aria-label={t("wordLimit")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORD_LIMIT_KEYS.map((key) => (
                <SelectItem key={key} value={key}>{WORD_LIMITS[key].instruction}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={generate} disabled={generating || !input.trim()}>
            {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {generating ? t("generating") : t("generate")}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">{t("myExercises")}</h3>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {exercises.map((e) => (
              <li key={e.id} className="flex items-center gap-2 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(e.id)}>
                  <div className="truncate font-medium hover:underline">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleDateString()} · {t("blanks", { count: e.blankCount })} ·{" "}
                    {e.attemptCount === 0
                      ? t("notAttempted")
                      : `${t("attempts", { count: e.attemptCount })} · ${t("bestScore", { score: e.bestScore ?? 0, total: e.blankCount })}`}
                  </div>
                </button>
                <Button variant="ghost" size="icon" onClick={() => remove(e.id)} aria-label={t("delete")}>
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
