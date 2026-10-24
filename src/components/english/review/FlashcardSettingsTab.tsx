"use client";

import { useEffect, useState } from "react";
import { useFlashcardSettings } from "./useFlashcardSettings";
import { useEnglishStudy } from "@/src/context/english";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
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

const MAX_REVIEW_OPTIONS = [
  { value: 10, label: "10" },
  { value: 20, label: "20" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
  { value: 0, label: "Không giới hạn" },
];

export function FlashcardSettingsTab() {
  const { settings, updateSettings } = useFlashcardSettings();
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
    <div className="max-w-xl mx-auto py-6 px-2 space-y-6">
      <div>
        <p className="text-xs text-muted-foreground mb-4">
          Cài đặt được lưu trên máy này.
        </p>

        <Row label="Số thẻ tối đa mỗi phiên">
          <div className="flex flex-wrap gap-1 justify-end">
            {MAX_REVIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateSettings({ maxReviews: opt.value })}
                className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                  settings.maxReviews === opt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Thứ tự ôn tập">
          <SegmentedControl
            options={[
              { value: "due", label: "Đến hạn trước" },
              { value: "random", label: "Ngẫu nhiên" },
            ]}
            value={settings.order}
            onChange={(v) => updateSettings({ order: v })}
          />
        </Row>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Quản lý từ trong lặp lại ngắt quãng</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm từ..."
          className="w-full mb-2 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="max-h-96 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {filteredWords.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Chưa có từ nào.</p>
          ) : (
            filteredWords.map((w) => (
              <div key={w.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm">{w.word}</span>
                <button
                  role="switch"
                  aria-checked={w.flashcardActive}
                  disabled={toggling === w.id}
                  onClick={() => toggleActive(w.id, !w.flashcardActive)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                    w.flashcardActive ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      w.flashcardActive ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
