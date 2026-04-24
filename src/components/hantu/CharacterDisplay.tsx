"use client";

import { CharacterInfo } from "@/src/data/hantu";
import { Badge } from "@/src/components/ui/badge";

interface CharacterDisplayProps {
  char: string;
  info: CharacterInfo | null;
}

export function CharacterDisplay({ char, info }: CharacterDisplayProps) {
  if (!info) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 h-full flex flex-col">
        <div className="flex items-start gap-4 mb-4">
          <div
            className="text-8xl font-bold leading-none select-none"
            style={{ fontFamily: "var(--font-noto-serif-sc), 'SimSun', 'STSong', serif" }}
          >
            {char}
          </div>
          <div className="flex-1">
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Không có trong cơ sở dữ liệu
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Chữ <span className="font-medium">{char}</span> chưa có trong dữ liệu. Hãy thử tra chữ khác.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-5">
      {/* Header: character + Hán Việt */}
      <div className="flex items-end gap-5">
        <div
          className="text-9xl font-bold leading-none select-none text-foreground"
          style={{ fontFamily: "var(--font-noto-serif-sc), 'SimSun', 'STSong', serif" }}
        >
          {char}
        </div>
        <div className="flex flex-col pb-2">
          <span className="text-3xl font-semibold text-primary">{info.hanViet}</span>
          <span className="text-sm text-muted-foreground italic">{info.pinyin}</span>
        </div>
      </div>

      {/* Meaning */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Nghĩa</span>
        <p className="text-sm text-foreground leading-relaxed">{info.meaning}</p>
      </div>

      {/* Radical */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Thuộc bộ</span>
        <div className="flex items-center gap-3">
          <span
            className="text-4xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-noto-serif-sc), 'SimSun', 'STSong', serif" }}
          >
            {info.radical}
          </span>
          <span className="text-sm text-muted-foreground">{info.radicalName}</span>
        </div>
      </div>

      {/* Components / decomposition */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Cấu tạo ({info.strokeCount} nét)
        </span>
        {info.components.length === 1 && info.components[0] === char ? (
          <p className="text-sm text-muted-foreground italic">Chữ tượng hình / chữ gốc, không phân tích thêm</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {info.components.map((comp, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2 min-w-[56px]"
              >
                <span
                  className="text-2xl font-bold leading-none"
                  style={{ fontFamily: "var(--font-noto-serif-sc), 'SimSun', 'STSong', serif" }}
                >
                  {comp}
                </span>
                {info.componentMeanings[i] && (
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {info.componentMeanings[i]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
