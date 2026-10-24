"use client";

import { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/Dialog";
import { Plus, X, RefreshCw } from "lucide-react";
import type { EnglishWord, EnglishSense } from "@/src/declaration/english";
import { useEnglishStudy } from "@/src/context/english";

interface EditWordModalProps {
  open: boolean;
  word: EnglishWord | null; // null = create mode
  onClose: () => void;
}

type SenseDraft = Omit<EnglishSense, "id" | "sortOrder">;

const emptySense: SenseDraft = {
  phonetic: "",
  partOfSpeech: "",
  cambridgeMeaning: "",
  meaningVi: "",
  example: "",
  synonyms: "",
  antonyms: "",
};

interface CambridgeCrawlData {
  fetchedAt?: string;
  url?: string;
  pronunciations?: { region?: string; ipa?: string; audioUrl?: string }[];
  senses?: { partOfSpeech?: string; definitions: { text: string; examples: string[] }[] }[];
  synonyms?: string[];
  antonyms?: string[];
  raw?: string;
}

function CambridgeInfoSection({ word, crawlData, onRefresh, loading, error }: {
  word: string;
  crawlData: CambridgeCrawlData | null;
  onRefresh: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Thông tin đầy đủ (từ điển Anh-Anh)
        </p>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading || !word.trim()}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Tải dữ liệu
        </Button>
      </div>

      {error && <p className="text-xs text-destructive italic">{error}</p>}

      {!crawlData && !loading && !error && (
        <p className="text-xs text-muted-foreground italic">Chưa có dữ liệu. Nhấn &quot;Tải dữ liệu&quot; để lấy.</p>
      )}

      {crawlData && (
        <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
          {(crawlData.pronunciations?.length ?? 0) > 0 && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              {crawlData.pronunciations!.map((p, i) => (
                <span key={i}>{p.region ? `${p.region.toUpperCase()} ` : ""}{p.ipa ? `/${p.ipa}/` : ""}</span>
              ))}
            </div>
          )}
          {(crawlData.senses?.length ?? 0) > 0 ? (
            crawlData.senses!.map((s, i) => (
              <div key={i} className="space-y-1">
                {s.partOfSpeech && (
                  <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium uppercase text-muted-foreground">
                    {s.partOfSpeech}
                  </span>
                )}
                <ul className="list-disc pl-4 space-y-1">
                  {s.definitions.map((d, j) => (
                    <li key={j}>
                      <span>{d.text}</span>
                      {d.examples.length > 0 && (
                        <ul className="pl-3 text-xs text-muted-foreground italic">
                          {d.examples.map((ex, k) => <li key={k}>&quot;{ex}&quot;</li>)}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : crawlData.raw ? (
            <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-6">{crawlData.raw}</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Không tìm thấy dữ liệu cho từ này.</p>
          )}
          {(crawlData.synonyms?.length ?? 0) > 0 && (
            <p className="text-xs"><span className="text-muted-foreground">Đồng nghĩa: </span>{crawlData.synonyms!.join(", ")}</p>
          )}
          {(crawlData.antonyms?.length ?? 0) > 0 && (
            <p className="text-xs"><span className="text-muted-foreground">Trái nghĩa: </span>{crawlData.antonyms!.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function EditWordModal({ open, word, onClose }: EditWordModalProps) {
  const { refetchWords } = useEnglishStudy();
  const [wordText, setWordText] = useState("");
  const [senses, setSenses] = useState<SenseDraft[]>([{ ...emptySense }]);
  const [saving, setSaving] = useState(false);
  const [crawlData, setCrawlData] = useState<CambridgeCrawlData | null>(null);
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrawlError(null);
    if (word) {
      setWordText(word.word);
      setSenses(
        word.senses.length > 0
          ? word.senses.map((s) => ({
              phonetic: s.phonetic ?? "",
              partOfSpeech: s.partOfSpeech ?? "",
              cambridgeMeaning: s.cambridgeMeaning ?? "",
              meaningVi: s.meaningVi ?? "",
              example: s.example ?? "",
              synonyms: s.synonyms ?? "",
              antonyms: s.antonyms ?? "",
            }))
          : [{ ...emptySense }]
      );
      setCrawlData((word.crawlData as CambridgeCrawlData | undefined) ?? null);
    } else {
      setWordText("");
      setSenses([{ ...emptySense }]);
      setCrawlData(null);
    }
  }, [open, word]);

  function updateSense(i: number, patch: Partial<SenseDraft>) {
    setSenses((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addSense() {
    setSenses((prev) => [...prev, { ...emptySense }]);
  }

  function removeSense(i: number) {
    setSenses((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function handleRefreshCambridge() {
    if (!wordText.trim()) return;
    setCrawlLoading(true);
    setCrawlError(null);
    try {
      const params = new URLSearchParams({ force: "1" });
      if (word) params.set("wordId", String(word.id));
      else params.set("word", wordText.trim());
      const res = await fetch(`/api/english/crawl?${params.toString()}`);
      const data = (await res.json()) as { crawlData?: CambridgeCrawlData; error?: string };
      if (data.crawlData) setCrawlData(data.crawlData);
      else if (data.error) setCrawlError(data.error);
    } catch {
      setCrawlError("Không lấy được dữ liệu từ điển.");
    } finally {
      setCrawlLoading(false);
    }
  }

  // Fills whatever is still blank across all senses (phonetic, example,
  // synonyms, antonyms, meaningVi) from the free dictionary lookup — fetching
  // it first if not already cached/loaded. Never overwrites a field the user
  // already filled in.
  async function handleAutoFillAll() {
    if (!wordText.trim()) return;
    setAutoFilling(true);
    try {
      let dict = crawlData;
      if (!dict) {
        const params = new URLSearchParams();
        if (word) params.set("wordId", String(word.id));
        else params.set("word", wordText.trim());
        const res = await fetch(`/api/english/crawl?${params.toString()}`);
        const data = (await res.json()) as { crawlData?: CambridgeCrawlData; error?: string };
        if (data.crawlData) {
          dict = data.crawlData;
          setCrawlData(data.crawlData);
        } else if (data.error) {
          setCrawlError(data.error);
        }
      }

      const synonymsText = (dict?.synonyms ?? []).slice(0, 6).join(", ");
      const antonymsText = (dict?.antonyms ?? []).slice(0, 6).join(", ");
      const ipa = dict?.pronunciations?.[0]?.ipa;

      const needsTranslation = senses.some((s) => !(s.meaningVi ?? "").trim());
      let wordTranslation: string | null = null;
      if (needsTranslation) {
        try {
          const tres = await fetch("/api/english/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: wordText.trim() }),
          });
          const tdata = (await tres.json()) as { translation: string | null };
          wordTranslation = tdata.translation;
        } catch {
          // best-effort, ignore
        }
      }

      setSenses((prev) =>
        prev.map((s) => {
          const match = dict?.senses?.find((ds) => ds.partOfSpeech?.toLowerCase() === (s.partOfSpeech ?? "").toLowerCase()) ?? dict?.senses?.[0];
          const def = match?.definitions[0];
          return {
            ...s,
            phonetic: s.phonetic || ipa || "",
            example: s.example || def?.examples[0] || "",
            synonyms: s.synonyms || synonymsText,
            antonyms: s.antonyms || antonymsText,
            meaningVi: s.meaningVi || wordTranslation || "",
          };
        })
      );
    } finally {
      setAutoFilling(false);
    }
  }

  async function handleSave() {
    if (!wordText.trim()) return;
    setSaving(true);
    try {
      const payload = {
        word: wordText.trim(),
        senses: senses
          .filter((s) => Object.values(s).some((v) => v && v.trim()))
          .map((s) => ({
            phonetic: s.phonetic || null,
            partOfSpeech: s.partOfSpeech || null,
            cambridgeMeaning: s.cambridgeMeaning || null,
            meaningVi: s.meaningVi || null,
            example: s.example || null,
            synonyms: s.synonyms || null,
            antonyms: s.antonyms || null,
          })),
        ...(word ? {} : { crawlData: crawlData ?? undefined }),
      };

      if (word) {
        await fetch(`/api/english/words/${word.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/english/words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      await refetchWords();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>{word ? "Sửa từ" : "Thêm từ mới"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Từ / cụm từ</label>
            <Input value={wordText} onChange={(e) => setWordText(e.target.value)} placeholder="vd: comprehensive" autoFocus />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nghĩa</p>
            {senses.map((s, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2 relative">
                {senses.length > 1 && (
                  <button
                    onClick={() => removeSense(i)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Phiên âm (IPA)" value={s.phonetic ?? ""} onChange={(e) => updateSense(i, { phonetic: e.target.value })} />
                  <Input placeholder="Loại từ (noun, verb...)" value={s.partOfSpeech ?? ""} onChange={(e) => updateSense(i, { partOfSpeech: e.target.value })} />
                </div>
                <Textarea placeholder="Nghĩa Cambridge (tiếng Anh)" value={s.cambridgeMeaning ?? ""} onChange={(e) => updateSense(i, { cambridgeMeaning: e.target.value })} rows={2} />
                <Textarea placeholder="Nghĩa tiếng Việt" value={s.meaningVi ?? ""} onChange={(e) => updateSense(i, { meaningVi: e.target.value })} rows={2} />
                <Textarea placeholder="Ví dụ" value={s.example ?? ""} onChange={(e) => updateSense(i, { example: e.target.value })} rows={2} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Từ đồng nghĩa (phân cách bởi dấu phẩy)" value={s.synonyms ?? ""} onChange={(e) => updateSense(i, { synonyms: e.target.value })} />
                  <Input placeholder="Từ trái nghĩa (phân cách bởi dấu phẩy)" value={s.antonyms ?? ""} onChange={(e) => updateSense(i, { antonyms: e.target.value })} />
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addSense}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Thêm nghĩa
              </Button>
              <Button variant="outline" size="sm" onClick={handleAutoFillAll} disabled={autoFilling || !wordText.trim()}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${autoFilling ? "animate-spin" : ""}`} />
                {autoFilling ? "Đang điền..." : "Tự động điền còn thiếu"}
              </Button>
            </div>
          </div>

          <CambridgeInfoSection
            word={wordText}
            crawlData={crawlData}
            onRefresh={handleRefreshCambridge}
            loading={crawlLoading}
            error={crawlError}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving || !wordText.trim()}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
