"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Undo2, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { useSpeech } from "@/src/hooks/useSpeech";
import type { CharacterInfo } from "@/src/data/chinese";
import type { UserEdits } from "@/src/declaration/chinese";

type Point = { x: number; y: number };
type Stroke = Point[];
type WritePhase = "draw" | "correct" | "wrong";

interface GradeSummary {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

interface FlashcardWriteTabProps {
  allChars: CharacterInfo[];
  userEdits: Record<string, UserEdits>;
}

const CANVAS_SIZE = 240;
const HSK_FONT_STYLE = { fontFamily: "var(--font-hsk)" };

export function FlashcardWriteTab({ allChars, userEdits }: FlashcardWriteTabProps) {
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [loadPhase, setLoadPhase] = useState<"loading" | "empty" | "active" | "done">("loading");
  const [summary, setSummary] = useState<GradeSummary>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [writePhase, setWritePhase] = useState<WritePhase>("draw");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastGradedRef = useRef<string | null>(null);
  const { speak } = useSpeech();

  const loadSession = useCallback(async () => {
    setLoadPhase("loading");
    setSummary({ again: 0, hard: 0, good: 0, easy: 0 });
    setIndex(0);
    try {
      const res = await fetch("/api/chinese/flashcard?mode=write");
      const data = await res.json() as { cards: string[] };
      if (data.cards.length === 0) {
        setLoadPhase("empty");
      } else {
        setQueue(data.cards);
        setLoadPhase("active");
      }
    } catch {
      setLoadPhase("empty");
    }
  }, []);

  useEffect(() => { loadSession(); }, [loadSession]);

  const charMap = useMemo(() => Object.fromEntries(allChars.map((c) => [c.char, c])), [allChars]);
  const current = queue[index];
  const info = current ? charMap[current] : null;
  const edits = current ? userEdits[current] : undefined;
  const pinyin = edits?.pinyin ?? info?.pinyin ?? "";
  const hanViet = edits?.hanViet ?? info?.hanViet ?? "";
  const meaningVi = edits?.meaningVi ?? info?.meaningVi ?? info?.meaning ?? "";
  const note = edits?.note ?? "";

  const redraw = useCallback((allStrokes: Stroke[], liveStroke: Stroke = []) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const drawStroke = (s: Stroke) => {
      if (s.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
      ctx.stroke();
    };
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of allStrokes) drawStroke(s);
    if (liveStroke.length > 0) drawStroke(liveStroke);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
  }, []);

  // Reset canvas on card change
  useEffect(() => {
    setStrokes([]);
    setCurrentStroke([]);
    setSuggestions([]);
    setWritePhase("draw");
    redraw([]);
  }, [index, redraw]);

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
    if (writePhase !== "draw") return;
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

  const recognize = async (allStrokes: Stroke[]) => {
    if (allStrokes.length === 0) return;
    setIsRecognizing(true);
    try {
      const ink = allStrokes.map((s) => [s.map((p) => p.x), s.map((p) => p.y)]);
      const res = await fetch("/api/chinese-recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ink, width: CANVAS_SIZE, height: CANVAS_SIZE }),
      });
      const data = await res.json() as { suggestions?: string[] };
      setSuggestions(data.suggestions ?? []);
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
    else setSuggestions([]);
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
    setSuggestions([]);
    redraw([]);
  };

  const handleSelectSuggestion = (char: string) => {
    if (char === current) {
      setWritePhase("correct");
    } else {
      setWritePhase("wrong");
    }
  };

  function persistGrade(char: string, g: 0 | 1 | 2 | 3) {
    void fetch("/api/chinese/flashcard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ char, grade: g, mode: "write" }),
      keepalive: true,
    }).catch(() => {});
  }

  function submitGrade(g: 0 | 1 | 2 | 3) {
    if (!current) return;

    const gradeToken = `${current}:${index}`;
    if (lastGradedRef.current === gradeToken) return;
    lastGradedRef.current = gradeToken;

    const gradeKey = (["again", "hard", "good", "easy"] as const)[g];
    const nextSummary = { ...summary, [gradeKey]: summary[gradeKey] + 1 };
    setSummary(nextSummary);

    const next = index + 1;
    if (next >= queue.length) {
      setLoadPhase("done");
    } else {
      setIndex(next);
    }
    persistGrade(current, g);
  }

  if (loadPhase === "loading") {
    return <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">Đang tải...</div>;
  }
  if (loadPhase === "empty") {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <p className="text-lg font-medium">Không có thẻ đến hạn hôm nay</p>
        <p className="text-sm">Đánh dấu thêm chữ là &quot;đã học&quot; hoặc quay lại vào ngày mai.</p>
      </div>
    );
  }
  if (loadPhase === "done") {
    const total = summary.again + summary.hard + summary.good + summary.easy;
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <p className="text-2xl font-semibold">Xong! {total} thẻ đã ôn</p>
        <div className="flex gap-6 text-sm">
          <span className="text-red-500">Không nhớ: {summary.again}</span>
          <span className="text-orange-500">Khó: {summary.hard}</span>
          <span className="text-green-600">Nhớ: {summary.good}</span>
          <span className="text-blue-500">Dễ: {summary.easy}</span>
        </div>
        <Button onClick={loadSession} variant="outline">Ôn lại từ đầu</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{index + 1} / {queue.length}</span>
        <div className="h-2 flex-1 mx-4 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
        </div>
      </div>

      {/* Main row: canvas left, info right */}
      <div className="flex gap-6 items-start">
        {/* Left: Drawing pad */}
        <div className="flex flex-col gap-3 items-center shrink-0">
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="border-2 border-border rounded-xl bg-white cursor-crosshair touch-none block"
              style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, opacity: writePhase !== "draw" ? 0.4 : 1 }}
              onMouseDown={onPointerDown}
              onMouseMove={onPointerMove}
              onMouseUp={onPointerUp}
              onMouseLeave={onPointerUp}
              onTouchStart={onPointerDown}
              onTouchMove={onPointerMove}
              onTouchEnd={onPointerUp}
            />
            <svg className="absolute inset-0 pointer-events-none rounded-xl" width={CANVAS_SIZE} height={CANVAS_SIZE}>
              <line x1={CANVAS_SIZE / 2} y1="0" x2={CANVAS_SIZE / 2} y2={CANVAS_SIZE} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1={CANVAS_SIZE / 2} x2={CANVAS_SIZE} y2={CANVAS_SIZE / 2} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
            </svg>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={strokes.length === 0 || writePhase !== "draw"} className="flex items-center gap-1.5">
              <Undo2 className="h-4 w-4" /> Hoàn tác
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear} disabled={strokes.length === 0 || writePhase !== "draw"} className="flex items-center gap-1.5">
              <Trash2 className="h-4 w-4" /> Xóa
            </Button>
          </div>
        </div>

        {/* Right: Info + suggestions/result */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Info */}
          <div className="border rounded-2xl p-5 flex flex-col gap-2 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                {pinyin && <p className="text-lg text-muted-foreground">{pinyin}</p>}
                {hanViet && <p className="text-base font-semibold">{hanViet}</p>}
                {meaningVi && <p className="text-base">{meaningVi}</p>}
                {note && <p className="text-sm text-muted-foreground italic">{note}</p>}
              </div>
              {writePhase !== "draw" && (
                <button
                  onClick={() => speak(current)}
                  className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0"
                  title="Phát âm"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              )}
            </div>

            {writePhase === "correct" && (
              <div className="flex items-center gap-2 text-green-600 font-medium mt-1">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-4xl font-light" style={HSK_FONT_STYLE}>{current}</span>
                <span className="text-sm">Chính xác!</span>
              </div>
            )}
            {writePhase === "wrong" && (
              <div className="flex items-center gap-2 text-red-500 font-medium mt-1">
                <XCircle className="h-5 w-5" />
                <span className="text-4xl font-light" style={HSK_FONT_STYLE}>{current}</span>
                <span className="text-sm">Đáp án đúng</span>
              </div>
            )}
          </div>

          {/* Suggestions */}
          {writePhase === "draw" && (
            <div className="flex flex-wrap gap-2 min-h-[3rem] items-center">
              {isRecognizing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {suggestions.map((char, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectSuggestion(char)}
                  className={`w-12 h-12 text-2xl rounded-lg border-2 transition-all hover:scale-105 hover:border-primary hover:shadow-md ${
                    char === current
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                  style={HSK_FONT_STYLE}
                >
                  {char}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {writePhase === "draw" && (
        <Button onClick={() => submitGrade(0)} variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 text-xs py-3 h-auto w-full">
          <span className="font-semibold">Không nhớ</span>
        </Button>
      )}

      {/* Grade buttons — shown after answered */}
      {writePhase !== "draw" && (
        <div className="grid grid-cols-4 gap-2 w-full">
          <Button onClick={() => submitGrade(0)} className="bg-red-500 hover:bg-red-600 text-white text-xs py-3 h-auto">
            <span className="font-semibold">Không nhớ</span>
          </Button>
          <Button onClick={() => submitGrade(1)} className="bg-orange-500 hover:bg-orange-600 text-white text-xs py-3 h-auto">
            <span className="font-semibold">Khó</span>
          </Button>
          <Button onClick={() => submitGrade(2)} className="bg-green-600 hover:bg-green-700 text-white text-xs py-3 h-auto">
            <span className="font-semibold">Nhớ</span>
          </Button>
          <Button onClick={() => submitGrade(3)} className="bg-blue-500 hover:bg-blue-600 text-white text-xs py-3 h-auto">
            <span className="font-semibold">Dễ</span>
          </Button>
        </div>
      )}
    </div>
  );
}
