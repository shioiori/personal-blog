"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
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

export function InlineEdit({
  value,
  placeholder,
  editLabel,
  required,
  onSave,
  children,
}: {
  value: string | null;
  placeholder?: string;
  editLabel: string;
  required?: boolean;
  onSave: (value: string) => Promise<boolean>;
  children: ReactNode;
}) {
  const tc = useTranslations("English.Common");
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const invalid = !!required && !draft?.trim();

  async function save() {
    if (draft === null || saving || invalid) return;
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) setDraft(null);
  }

  if (draft === null) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        {children}
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDraft(value ?? "")} aria-label={editLabel}>
          <Pencil />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
          if (e.key === "Escape") setDraft(null);
        }}
        placeholder={placeholder}
        maxLength={500}
        autoFocus
        className="h-9 max-w-md"
      />
      <Button size="sm" onClick={save} disabled={saving || invalid}>
        {saving && <Loader2 className="animate-spin" />}
        {tc("save")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
        {tc("cancel")}
      </Button>
    </div>
  );
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
