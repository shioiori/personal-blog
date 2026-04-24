"use client";

import { useState, useCallback, useEffect } from "react";
import { DrawingCanvas } from "./DrawingCanvas";
import { CharacterDisplay } from "./CharacterDisplay";
import { HistoryPanel, HistoryEntry } from "./HistoryPanel";
import { HANTU_DATA, searchCharacter } from "@/src/data/hantu";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/Button";
import { Search, BookOpen } from "lucide-react";

const HISTORY_KEY = "hantu-history";
const MAX_HISTORY = 24;

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

export function HanTuPage() {
  const [currentChar, setCurrentChar] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState<string>("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const selectChar = useCallback(
    (char: string) => {
      setCurrentChar(char);
      setCandidates([]);
      const info = HANTU_DATA[char];
      const entry: HistoryEntry = {
        char,
        hanViet: info?.hanViet ?? null,
        timestamp: Date.now(),
      };
      const updated = [entry, ...history.filter((h) => h.char !== char)].slice(0, MAX_HISTORY);
      setHistory(updated);
      saveHistory(updated);
    },
    [history]
  );

  const handleRecognize = useCallback(async (imageData: string) => {
    setIsRecognizing(true);
    setRecognitionStatus("Đang tải mô hình nhận dạng (lần đầu có thể mất vài giây)...");
    setCandidates([]);

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("chi_sim", 1, {
        logger: (m: { status: string }) => {
          if (m.status === "loading tesseract core") setRecognitionStatus("Đang tải nhân xử lý...");
          else if (m.status === "loading language traineddata") setRecognitionStatus("Đang tải dữ liệu tiếng Hán...");
          else if (m.status === "recognizing text") setRecognitionStatus("Đang nhận dạng chữ...");
        },
      });

      await worker.setParameters({
        tessedit_pageseg_mode: "10" as any,
        tessedit_char_whitelist: Object.keys(HANTU_DATA).join(""),
      });

      const { data } = await worker.recognize(imageData);
      await worker.terminate();

      const chars = (data.text.match(/[\u4e00-\u9fff]/g) || []).filter(
        (c) => !!HANTU_DATA[c]
      );

      if (chars.length > 0) {
        setRecognitionStatus(`Tìm thấy ${chars.length} ký tự. Chọn chữ bên dưới:`);
        setCandidates([...new Set(chars)].slice(0, 6));
        selectChar(chars[0]);
      } else {
        setRecognitionStatus(
          "Không nhận ra chữ Hán nào. Hãy viết rõ hơn hoặc tra thủ công bên dưới."
        );
      }
    } catch (err) {
      console.error(err);
      setRecognitionStatus("Lỗi nhận dạng. Hãy thử tra thủ công bằng ô tìm kiếm.");
    } finally {
      setIsRecognizing(false);
    }
  }, [selectChar]);

  const handleManualSearch = () => {
    const char = inputValue.trim();
    if (!char) return;
    const info = searchCharacter(char);
    setCurrentChar(char);
    setCandidates([]);
    setRecognitionStatus("");
    if (!info) {
      setRecognitionStatus(`Chữ "${char}" chưa có trong cơ sở dữ liệu.`);
    }
    const entry: HistoryEntry = {
      char,
      hanViet: info?.hanViet ?? null,
      timestamp: Date.now(),
    };
    const updated = [entry, ...history.filter((h) => h.char !== char)].slice(0, MAX_HISTORY);
    setHistory(updated);
    saveHistory(updated);
    setInputValue("");
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">漢字 · Hán Tự</h1>
        <p className="text-muted-foreground text-sm">
          Viết chữ Hán lên bảng để nhận dạng, hoặc nhập trực tiếp vào ô tìm kiếm.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
        {/* Left: drawing + search */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-widest">
              Viết tay
            </h2>
            <DrawingCanvas
              onRecognize={handleRecognize}
              isRecognizing={isRecognizing}
              recognitionStatus={recognitionStatus}
            />
          </div>

          {/* Candidates */}
          {candidates.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Chọn chữ phù hợp
              </p>
              <div className="flex flex-wrap gap-2">
                {candidates.map((char) => (
                  <button
                    key={char}
                    onClick={() => selectChar(char)}
                    className={`text-3xl font-bold px-3 py-2 rounded-xl border transition-colors ${
                      currentChar === char
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent"
                    }`}
                    style={{ fontFamily: "var(--font-noto-serif-sc), 'SimSun', 'STSong', serif" }}
                  >
                    {char}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual search */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-widest">
              Tra thủ công
            </h2>
            <div className="flex gap-2">
              <Input
                placeholder="Nhập chữ Hán (vd: 好, 明, 龙...)"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                className="flex-1 text-lg"
                maxLength={1}
              />
              <Button onClick={handleManualSearch} disabled={!inputValue.trim()} className="gap-2">
                <Search className="h-4 w-4" />
                Tra
              </Button>
            </div>
          </div>
        </div>

        {/* Right: character display */}
        <div>
          {currentChar ? (
            <CharacterDisplay char={currentChar} info={HANTU_DATA[currentChar] ?? null} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border h-full min-h-[400px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <BookOpen className="h-10 w-10 opacity-30" />
              <p className="text-sm">Viết hoặc nhập một chữ Hán để xem thông tin</p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <HistoryPanel history={history} onSelect={selectChar} onClear={handleClearHistory} />
    </div>
  );
}
