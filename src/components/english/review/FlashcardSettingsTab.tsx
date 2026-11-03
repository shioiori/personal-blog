"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { FlashcardSettings } from "./useFlashcardSettings";
import { useEnglishStudy } from "@/src/context/english";
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
  onChange: updateSettings,
}: {
  settings: FlashcardSettings;
  onChange: (patch: Partial<FlashcardSettings>) => void;
}) {
  const t = useTranslations("English");
  const { words, refetchWords } = useEnglishStudy();
  const [toggling, setToggling] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { void refetchWords(); }, [refetchWords]);

  async function toggleActive(wordId: number, active: boolean) {
    setToggling(wordId);
    try {
      await fetch("/api/english/flashcard/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId, active }),
      });
      await refetchWords();
    } finally {
      setToggling(null);
    }
  }

  const filteredWords = words.filter((w) => !search.trim() || w.word.toLowerCase().includes(search.trim().toLowerCase()));

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
                  settings.maxReviews === value
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
            value={settings.order}
            onChange={(v) => updateSettings({ order: v })}
          />
        </Row>

        <Row label={t("Settings.autoPronounce")}>
          <Switch checked={settings.autoPronounce} onChange={(v) => updateSettings({ autoPronounce: v })} />
        </Row>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">{t("Settings.manage")}</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Common.searchWord")}
          className="w-full mb-2 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="max-h-96 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {filteredWords.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("Common.noWordsYet")}</p>
          ) : (
            filteredWords.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm truncate min-w-0">{w.word}</span>
                <Switch checked={w.flashcardActive} disabled={toggling === w.id} onChange={(v) => toggleActive(w.id, v)} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
