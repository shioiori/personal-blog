"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { FlashcardSettings } from "./useFlashcardSettings";
import type { EnglishWord } from "@/src/declaration/english";
import { useEnglishStudy } from "@/src/context/english";
import { Button } from "@/src/components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/Select";
import { DueForecastChart } from "./DueForecastChart";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-md border overflow-hidden text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 transition-colors ${
            value === opt.value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 shrink-0 ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const MAX_REVIEW_OPTIONS = [10, 20, 50, 100, 0];

export function FlashcardSettingsTab({
  settings,
  onSave,
}: {
  settings: FlashcardSettings;
  onSave: (next: FlashcardSettings) => void;
}) {
  const t = useTranslations("English");
  const { words, groups, refetchWords } = useEnglishStudy();
  const [draft, setDraft] = useState(settings);
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void refetchWords(); }, [refetchWords]);

  const updateSettings = (patch: Partial<FlashcardSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const isActive = (w: EnglishWord) => overrides[w.id] ?? w.flashcardActive;
  const setActive = (ids: number[], active: boolean) =>
    setOverrides((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, active])) }));

  const q = search.trim().toLowerCase();
  const filteredWords = words.filter((w) =>
    (groupFilter === "all" || (groupFilter === "none" ? w.groupIds.length === 0 : w.groupIds.includes(Number(groupFilter)))) &&
    (!q || w.word.toLowerCase().includes(q)));
  const allActive = filteredWords.length > 0 && filteredWords.every(isActive);
  const changed = words.filter((w) => overrides[w.id] !== undefined && overrides[w.id] !== w.flashcardActive);
  const dirty = changed.length > 0 || (Object.keys(draft) as (keyof FlashcardSettings)[]).some((k) => draft[k] !== settings[k]);

  async function save() {
    setSaving(true);
    try {
      await Promise.all([true, false].map((active) => {
        const wordIds = changed.filter((w) => overrides[w.id] === active).map((w) => w.id);
        return wordIds.length > 0 && fetch("/api/english/flashcard/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wordIds, active }),
        });
      }));
      await refetchWords();
      onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium mb-2">{t("Settings.forecast")}</p>
        <DueForecastChart />
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-4">
          {t("Settings.savedLocally")}
        </p>

        <Row label={t("Settings.maxCards")}>
          <div className="flex flex-wrap gap-1 justify-end">
            {MAX_REVIEW_OPTIONS.map((value) => (
              <button
                key={value}
                onClick={() => updateSettings({ maxReviews: value })}
                className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                  draft.maxReviews === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {value === 0 ? t("Settings.unlimited") : value}
              </button>
            ))}
          </div>
        </Row>

        <Row label={t("Settings.order")}>
          <SegmentedControl
            options={[
              { value: "due", label: t("Settings.orderDue") },
              { value: "random", label: t("Settings.orderRandom") },
            ]}
            value={draft.order}
            onChange={(v) => updateSettings({ order: v })}
          />
        </Row>

        <Row label={t("Settings.autoPronounce")}>
          <Switch checked={draft.autoPronounce} onChange={(v) => updateSettings({ autoPronounce: v })} />
        </Row>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">{t("Settings.manage")}</p>
        <div className="flex flex-wrap gap-2 mb-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Common.searchWord")}
            className="flex-1 min-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[180px] max-w-full">
              <SelectValue placeholder={t("Words.allGroups")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Words.allGroups")}</SelectItem>
              <SelectItem value="none">{t("Settings.ungrouped")}</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-96 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {filteredWords.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("Common.noWordsYet")}</p>
          ) : (
            <>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2 bg-muted">
                <span className="text-sm font-medium">{t("Settings.toggleAll", { count: filteredWords.length })}</span>
                <Switch checked={allActive} onChange={(v) => setActive(filteredWords.map((w) => w.id), v)} />
              </div>
              {filteredWords.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm truncate min-w-0">{w.word}</span>
                  <Switch checked={isActive(w)} onChange={(v) => setActive([w.id], v)} />
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="sticky -bottom-6 -mb-6 pt-3 pb-6 bg-background border-t flex justify-end">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? t("Common.saving") : t("Common.save")}
        </Button>
      </div>
    </div>
  );
}
