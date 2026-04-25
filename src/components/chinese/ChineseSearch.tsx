"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/src/components/ui/Button";
import { useTranslations } from "next-intl";
import { Undo2, Trash2, Loader2 } from "lucide-react";
import { HskLevel } from "@/src/data/chinese";

type Point = { x: number; y: number };
type Stroke = Point[];

interface CharInfo {
  char: string;
  pinyin: string | null;
  meaning: string | null;
  hanViet: string | null;
  meaningVi: string | null;
  hsk: HskLevel | null;
}

const CANVAS_SIZE = 300;

const HSK_COLOR: Record<string, string> = {
  "1": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "2": "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200",
  "3": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "4": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "5": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "6": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "beyond": "bg-muted text-muted-foreground",
};

export function ChineseSearch() {
  const t = useTranslations("Chinese");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Map of char -> info, loaded in bulk after recognition
  const [suggestionInfos, setSuggestionInfos] = useState<CharInfo[]>([]);
  const [selectedChar, setSelectedChar] = useState<CharInfo | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);

  const redraw = useCallback((allStrokes: Stroke[], liveStroke: Stroke = []) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawStroke = (stroke: Stroke) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    };

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of allStrokes) drawStroke(stroke);
    if (liveStroke.length > 0) drawStroke(liveStroke);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const onPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setCurrentStroke([getPos(e)]);
  };

  const onPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pt = getPos(e);
    setCurrentStroke((prev) => {
      const next = [...prev, pt];
      redraw(strokes, next);
      return next;
    });
  };

  const onPointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || currentStroke.length === 0) return;
    setIsDrawing(false);
    const finished = [...strokes, currentStroke];
    setStrokes(finished);
    setCurrentStroke([]);
    redraw(finished);
    recognize(finished);
  };

  const fetchInfo = async (char: string): Promise<CharInfo> => {
    try {
      const res = await fetch(`/api/chinese-info?char=${encodeURIComponent(char)}`);
      return await res.json();
    } catch {
      return { char, pinyin: null, meaning: null, hanViet: null, meaningVi: null, hsk: null };
    }
  };

  const recognize = async (allStrokes: Stroke[]) => {
    if (allStrokes.length === 0) return;
    setIsRecognizing(true);
    setSuggestionInfos([]);
    setSelectedChar(null);
    try {
      const ink = allStrokes.map((s) => [s.map((p) => p.x), s.map((p) => p.y)]);
      const res = await fetch("/api/chinese-recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ink, width: CANVAS_SIZE, height: CANVAS_SIZE })
      });
      const data = await res.json();
      const chars: string[] = data.suggestions ?? [];
      // Fetch info for all suggestions in parallel
      const infos = await Promise.all(chars.map(fetchInfo));
      setSuggestionInfos(infos);
    } catch {
      // silently fail
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleUndo = () => {
    const next = strokes.slice(0, -1);
    setStrokes(next);
    redraw(next);
    if (next.length > 0) recognize(next);
    else { setSuggestionInfos([]); setSelectedChar(null); }
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
    setSuggestionInfos([]);
    setSelectedChar(null);
    redraw([]);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left: Drawing pad */}
      <div className="flex flex-col gap-4 shrink-0">
        <p className="text-sm text-muted-foreground">{t("drawInstruction")}</p>

        <div className="relative inline-block">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="border-2 border-border rounded-xl bg-white cursor-crosshair touch-none block"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
          />
          <svg
            className="absolute inset-0 pointer-events-none rounded-xl"
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
          >
            <line x1={CANVAS_SIZE / 2} y1="0" x2={CANVAS_SIZE / 2} y2={CANVAS_SIZE} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1={CANVAS_SIZE / 2} x2={CANVAS_SIZE} y2={CANVAS_SIZE / 2} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
          </svg>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleUndo} disabled={strokes.length === 0} className="flex items-center gap-1.5">
            <Undo2 className="h-4 w-4" />{t("undo")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} disabled={strokes.length === 0} className="flex items-center gap-1.5">
            <Trash2 className="h-4 w-4" />{t("clear")}
          </Button>
        </div>
      </div>

      {/* Right: Suggestions list + expanded detail */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {t("suggestions")}
          </h3>
          {isRecognizing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {suggestionInfos.length === 0 && !isRecognizing && (
          <p className="text-sm text-muted-foreground italic">
            {strokes.length === 0 ? t("startDrawing") : t("noSuggestions")}
          </p>
        )}

        {/* Suggestion rows */}
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
          {suggestionInfos.map((info) => (
            <button
              key={info.char}
              onClick={() => setSelectedChar(selectedChar?.char === info.char ? null : info)}
              className={`flex items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent ${
                selectedChar?.char === info.char ? "bg-primary/5 border-l-2 border-l-primary" : ""
              }`}
            >
              {/* Character */}
              <span className="text-3xl leading-none w-10 text-center shrink-0" style={{ fontFamily: "serif" }}>
                {info.char}
              </span>

              {/* Pinyin + meaning */}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-primary">{info.pinyin ?? ""}</span>
                <span className="text-sm text-muted-foreground truncate">
                  {info.hanViet ? `${info.hanViet} · ` : ""}
                  {info.meaningVi ?? info.meaning ?? "—"}
                </span>
              </div>

              {/* HSK badge */}
              {info.hsk && (
                <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${HSK_COLOR[String(info.hsk)]}`}>
                  {info.hsk === "beyond" ? "—" : `HSK ${info.hsk}`}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Expanded detail panel */}
        {selectedChar && (
          <div className="border border-border rounded-xl p-6 bg-card">
            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <span className="text-8xl leading-none select-all" style={{ fontFamily: "serif" }}>
                  {selectedChar.char}
                </span>
                {selectedChar.hsk && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${HSK_COLOR[String(selectedChar.hsk)]}`}>
                    {selectedChar.hsk === "beyond" ? "Beyond HSK" : `HSK ${selectedChar.hsk}`}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3 pt-1 min-w-0">
                <InfoRow label={t("pinyin")} value={selectedChar.pinyin} />
                {selectedChar.hanViet && <InfoRow label={t("hanViet")} value={selectedChar.hanViet} />}
                {selectedChar.meaningVi && <InfoRow label={t("meaningVi")} value={selectedChar.meaningVi} />}
                <InfoRow label={t("meaning")} value={selectedChar.meaning} className="text-sm text-muted-foreground" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, className }: { label: string; value: string | null; className?: string }) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <p className={`mt-0.5 ${className ?? "text-base font-medium"}`}>{value ?? "—"}</p>
    </div>
  );
}
