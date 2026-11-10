"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/Select";
import { WORD_LIMITS, WORD_LIMIT_KEYS, type WordLimit } from "@/src/lib/gapfill-word-limit";

type GapFillT = ReturnType<typeof useTranslations>;

export function WordLimitSelect({ value, onChange, disabled }: { value: WordLimit; onChange: (v: WordLimit) => void; disabled?: boolean }) {
  const t = useTranslations("English.GapFill");
  return (
    <Select value={value} onValueChange={(v) => onChange(v as WordLimit)} disabled={disabled}>
      <SelectTrigger className="w-auto max-w-full" aria-label={t("wordLimit")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WORD_LIMIT_KEYS.map((key) => (
          <SelectItem key={key} value={key}>{WORD_LIMITS[key].instruction}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SourceText({ source }: { source: string | null }) {
  if (source && /^https?:\/\//i.test(source)) {
    return <a href={source} target="_blank" rel="noopener noreferrer" className="truncate underline">{source}</a>;
  }
  return <span className="truncate">{source ?? "—"}</span>;
}

export async function generateExercise(
  body: { input?: string; scriptId?: number; wordLimit: WordLimit; source?: string },
  t: GapFillT
): Promise<{ id: number; scriptId: number } | null> {
  try {
    const res = await fetch("/api/english/gapfill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      id?: number;
      scriptId?: number;
      needsPremium?: boolean;
      invalid?: boolean;
      tooLong?: boolean;
      tooSimilar?: boolean;
    };
    if (!res.ok || !data.id || !data.scriptId) {
      toast.error(
        t(
          data.needsPremium
            ? "needsPremium"
            : data.invalid
              ? "invalidInput"
              : data.tooLong
                ? "tooLong"
                : data.tooSimilar
                  ? "tooSimilar"
                  : "generateFailed"
        )
      );
      return null;
    }
    toast.success(t("generated"));
    return { id: data.id, scriptId: data.scriptId };
  } catch {
    toast.error(t("generateFailed"));
    return null;
  }
}
