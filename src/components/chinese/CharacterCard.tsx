"use client";

import { useState, memo } from "react";
import { Pencil, Copy, Check, Star } from "lucide-react";
import { cn } from "@/src/utils/ui";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/src/components/ui/Tooltip";
import { EditCardModal, type UserEdits } from "./EditCardModal";
import type { CharacterInfo } from "@/src/data/chinese";

interface CharacterCardProps {
  info: CharacterInfo;
  edits: UserEdits;
  hidden: boolean;
  onToggleHide: (char: string) => void;
  onSave: (char: string, edits: UserEdits) => void;
  onNavigate?: (char: string) => void;
  // returns true = already verified (open modal now), false = prompting key
  onEditRequest: () => boolean;
  editLocked: boolean;
}

export const CharacterCard = memo(function CharacterCard({ info, edits, hidden, onToggleHide, onSave, onNavigate, onEditRequest, editLocked }: CharacterCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayPinyin = edits.pinyin || info.pinyin;
  const displayMeaning = edits.meaningVi || info.meaning;

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(info.char).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <>
      <div
        id={`char-${info.char}`}
        className={cn(
          "relative rounded-2xl border border-border bg-card p-3 pt-8",
          "transition-all duration-200 hover:border-primary/50",
          "flex flex-col items-center gap-1.5",
          !hidden && "opacity-30"
        )}
      >
        {/* Top-left star rating */}
        {info.hsk !== "beyond" && (
          <div className="absolute top-2 left-2 flex items-center gap-0.5">
            {Array.from({ length: info.hsk as number }, (_, i) => (
              <Star
                key={i}
                className="h-2.5 w-2.5"
                style={{ color: [
                  "",
                  "#9ca3af",
                  "#e2e8f0",
                  "#22c55e",
                  "#22d3ee",
                  "#3b82f6",
                  "#a855f7",
                  "#facc15",
                  "#f97316",
                  "#ef4444",
                ][info.hsk as number], fill: "currentColor", stroke: "none" }}
              />
            ))}
          </div>
        )}

        {/* Top-right actions */}
        <div
          className="absolute top-2 right-2 flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { if (onEditRequest()) setEditOpen(true); }}
            disabled={editLocked}
            className="text-muted-foreground/50 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={editLocked ? "Chỉnh sửa bị khoá" : "Chỉnh sửa"}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <Checkbox
            checked={hidden}
            onCheckedChange={() => onToggleHide(info.char)}
            className="h-3.5 w-3.5"
            title={hidden ? "Đã biết — bấm để bỏ" : "Đánh dấu đã biết"}
          />
        </div>

        {/* Character + copy */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 group cursor-default">
                <div
                  className="text-5xl font-bold leading-none select-text cursor-text"
                  style={{ fontFamily: "var(--font-noto-serif-sc), 'SimSun', 'STSong', serif" }}
                >
                  {info.char}
                </div>
                <button
                  onClick={handleCopy}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-primary self-start mt-1"
                  title="Copy"
                >
                  {copied
                    ? <Check className="h-3 w-3 text-green-500" />
                    : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs space-y-1.5 p-3">
              {/* Chữ + pinyin */}
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold" style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}>{info.char}</span>
                <span className="tracking-wider">{displayPinyin}</span>
              </div>
              {/* Stars + HSK */}
              {info.hsk !== "beyond" && (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: info.hsk as number }, (_, i) => (
                      <Star key={i} className="h-2.5 w-2.5" style={{ color: ["","#9ca3af","#e2e8f0","#22c55e","#22d3ee","#3b82f6","#a855f7","#facc15","#f97316","#ef4444"][info.hsk as number], fill: "currentColor", stroke: "none" }} />
                    ))}
                  </div>
                  <span>HSK {info.hsk}</span>
                </div>
              )}
              {/* Nghĩa */}
              <p>{displayMeaning}</p>
              {/* Thông tin thêm */}
              {(edits.hanViet || edits.meaningVi || info.meaning || edits.note) && (
                <div className="space-y-0.5 opacity-80">
                  {edits.hanViet && <p><span className="font-medium">Hán Việt:</span> {edits.hanViet}</p>}
                  {edits.meaningVi && <p><span className="font-medium">🇻🇳</span> {edits.meaningVi}</p>}
                  {info.meaning && edits.meaningVi && <p><span className="font-medium">🇬🇧</span> {info.meaning}</p>}
                  {edits.note && <p className="italic">{edits.note}</p>}
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Pinyin + meaning — blur when hidden */}
        <div
          className={cn(
            "flex flex-col items-center gap-0.5 transition-all duration-300 w-full select-text",
            hidden ? "opacity-30 blur-[3px] pointer-events-none" : "opacity-100 blur-none"
          )}
        >
          {edits.hanViet && (
            <p className="text-xs font-semibold text-foreground/80 tracking-wide">
              {edits.hanViet}
            </p>
          )}
          <p className="text-xs font-medium text-muted-foreground tracking-wider cursor-text">
            {displayPinyin}
          </p>
          <p className="text-xs text-center text-foreground line-clamp-2 px-1 cursor-text">
            {displayMeaning}
          </p>
          {edits.note && (
            <p className="text-[10px] text-muted-foreground/70 italic text-center px-1 line-clamp-1">
              {edits.note}
            </p>
          )}
        </div>

        {/* Components */}
        {onNavigate && info.components.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center mt-0.5">
            {info.components.map((comp) => (
              <button
                key={comp}
                onClick={() => onNavigate(comp)}
                className="text-sm leading-none px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
                title={`Xem ${comp}`}
              >
                {comp}
              </button>
            ))}
          </div>
        )}

      </div>

      <EditCardModal
        info={info}
        edits={edits}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={onSave}
      />
    </>
  );
});
