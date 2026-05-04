"use client";

import type { FlashcardSettings } from "@/src/hooks/useFlashcardSettings";

interface Props {
  settings: FlashcardSettings;
  onChange: (patch: Partial<FlashcardSettings>) => void;
}

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
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted"
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

export function FlashcardSettingsTab({ settings, onChange }: Props) {
  return (
    <div className="max-w-md mx-auto py-6 px-2">
      <p className="text-xs text-muted-foreground mb-4">
        Cài đặt được lưu trên máy này và áp dụng cho cả hai chế độ Lật thẻ và Viết chữ.
      </p>

      <Row label="Số thẻ tối đa mỗi phiên">
        <div className="flex flex-wrap gap-1 justify-end">
          {MAX_REVIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ maxReviews: opt.value })}
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
          onChange={(v) => onChange({ order: v })}
        />
      </Row>

      <Row label="Mặt trước hiển thị">
        <SegmentedControl
          options={[
            { value: "char", label: "Chữ Hán" },
            { value: "pinyin", label: "Pinyin" },
            { value: "meaning", label: "Nghĩa" },
          ]}
          value={settings.frontSide}
          onChange={(v) => onChange({ frontSide: v })}
        />
      </Row>

      <Row label="Hiện gợi ý pinyin ở mặt trước">
        <button
          role="switch"
          aria-checked={settings.showPinyinOnFront}
          onClick={() => onChange({ showPinyinOnFront: !settings.showPinyinOnFront })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            settings.showPinyinOnFront ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              settings.showPinyinOnFront ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </Row>
    </div>
  );
}
