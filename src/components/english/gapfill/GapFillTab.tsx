"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Textarea } from "@/src/components/ui/Textarea";
import { Input } from "@/src/components/ui/Input";
import { DEFAULT_WORD_LIMIT, type WordLimit } from "@/src/lib/gapfill-word-limit";
import { GapFillExerciseView } from "@/src/components/english/gapfill/GapFillExercise";
import { GapFillScriptView } from "@/src/components/english/gapfill/GapFillScript";
import { WordLimitSelect, generateExercise } from "@/src/components/english/gapfill/shared";
import type { GapFillScriptSummary } from "@/src/declaration/english";

type View =
  | { kind: "list" }
  | { kind: "script"; scriptId: number }
  | { kind: "exercise"; scriptId: number; exerciseId: number };

export function GapFillTab() {
  const t = useTranslations("English.GapFill");
  const [view, setView] = useState<View>({ kind: "list" });
  const [scripts, setScripts] = useState<GapFillScriptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("");
  const [input, setInput] = useState("");
  const [wordLimit, setWordLimit] = useState<WordLimit>(DEFAULT_WORD_LIMIT);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/english/gapfill");
      if (res.ok) setScripts(((await res.json()) as { scripts: GapFillScriptSummary[] }).scripts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view.kind === "list") void load();
  }, [view.kind, load]);

  async function generate() {
    if (generating || !input.trim()) return;
    setGenerating(true);
    const result = await generateExercise({ input, wordLimit, source }, t);
    setGenerating(false);
    if (!result) return;
    setInput("");
    setSource("");
    setView({ kind: "exercise", scriptId: result.scriptId, exerciseId: result.id });
  }

  async function removeScript(id: number) {
    if (!confirm(t("confirmDeleteScript"))) return;
    await fetch(`/api/english/gapfill/scripts/${id}`, { method: "DELETE" });
    setScripts((list) => list.filter((s) => s.id !== id));
  }

  if (view.kind === "exercise") {
    return <GapFillExerciseView id={view.exerciseId} onBack={() => setView({ kind: "script", scriptId: view.scriptId })} />;
  }

  if (view.kind === "script") {
    return (
      <GapFillScriptView
        id={view.scriptId}
        onBack={() => setView({ kind: "list" })}
        onOpenExercise={(exerciseId) => setView({ kind: "exercise", scriptId: view.scriptId, exerciseId })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("source")}</label>
        <Input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={t("sourcePlaceholder")}
          maxLength={500}
          disabled={generating}
        />
        <label className="block pt-2 text-sm font-medium">{t("inputLabel")}</label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("inputPlaceholder")}
          className="min-h-48 max-h-[50vh]"
          disabled={generating}
        />
        <div className="flex flex-wrap items-center gap-2">
          <WordLimitSelect value={wordLimit} onChange={setWordLimit} disabled={generating} />
          <Button onClick={generate} disabled={generating || !input.trim()}>
            {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {generating ? t("generating") : t("generate")}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">{t("myScripts")}</h3>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : scripts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noScripts")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {scripts.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setView({ kind: "script", scriptId: s.id })}>
                  <div className="truncate font-medium hover:underline">{s.name ?? s.preview}</div>
                  {s.source && <div className="truncate text-xs text-muted-foreground">{s.source}</div>}
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString()} · {t("exerciseCount", { count: s.exerciseCount })}
                  </div>
                </button>
                <Button variant="ghost" size="icon" onClick={() => removeScript(s.id)} aria-label={t("delete")}>
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
