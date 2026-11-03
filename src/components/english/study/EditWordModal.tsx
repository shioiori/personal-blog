"use client";

import { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/Dialog";
import { Plus, X, RefreshCw, Pencil, Trash2 } from "lucide-react";
import type { EnglishWord, EnglishSense } from "@/src/declaration/english";
import { useEnglishStudy } from "@/src/context/english";
import { PronounceButton } from "./PronounceButton";
import type { CambridgeCrawlData } from "./crawlData";

interface EditWordModalProps {
  open: boolean;
  word: EnglishWord | null; // null = create mode
  onClose: () => void;
  onDelete?: (id: number) => void;
  /** Opens straight into the edit form instead of the read-only view (ignored in create mode, which is always the form). */
  startInEditMode?: boolean;
  /** Called when the user clicks a related-word chip; parent should swap in that word and keep the modal open. */
  onOpenWord?: (id: number) => void;
}

function parseRelatedWords(text: string): string[] {
  return text
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}

// Suggests other words in the library that likely share a root with `wordText`
// (e.g. "obesity" ~ "obese"), purely by comparing a leading substring — no
// external lookup. Heuristic, not an auto-add: the user still picks which
// suggestions to keep.
function suggestRelatedWords(wordText: string, allWords: EnglishWord[], excludeId?: number, already?: Set<string>): string[] {
  const target = wordText.trim().toLowerCase();
  if (target.length < 4) return [];
  const results: string[] = [];
  for (const w of allWords) {
    if (w.id === excludeId) continue;
    const candidate = w.word.trim().toLowerCase();
    if (!candidate || candidate === target) continue;
    if (already?.has(candidate)) continue;
    const shorter = Math.min(candidate.length, target.length);
    let commonPrefix = 0;
    while (commonPrefix < shorter && candidate[commonPrefix] === target[commonPrefix]) commonPrefix++;
    if (commonPrefix >= 4 && commonPrefix >= shorter * 0.7) {
      results.push(w.word);
    }
  }
  return results.slice(0, 5);
}

const POS_ABBREV: Record<string, string> = {
  noun: "n",
  verb: "v",
  adjective: "adj",
  adverb: "adv",
  preposition: "prep",
  pronoun: "pron",
  conjunction: "conj",
  interjection: "interj",
  phrase: "phr",
  idiom: "idiom",
  "phrasal verb": "phr.v",
  collocation: "coll",
};

function abbreviatePos(pos?: string): string {
  if (!pos) return "";
  const key = pos.trim().toLowerCase();
  return POS_ABBREV[key] ?? key;
}

function toSenseInput(s: EnglishSense) {
  return {
    phonetic: s.phonetic || null,
    partOfSpeech: s.partOfSpeech || null,
    cambridgeMeaning: s.cambridgeMeaning || null,
    meaningVi: s.meaningVi || null,
    example: s.example || null,
    synonyms: s.synonyms || null,
    antonyms: s.antonyms || null,
  };
}

// Keeps related-word links symmetric: when word A gains/loses B as a related
// word, B's own relatedWords list is updated to match. Only touches the other
// word's relatedWords field — its senses are sent back unchanged so this never
// wipes out its own data.
async function syncRelatedWords(
  currentWordId: number | undefined,
  currentWordText: string,
  oldRelatedTexts: string[],
  newRelatedTexts: string[],
  allWords: EnglishWord[]
) {
  const was = new Set(oldRelatedTexts.map((t) => t.toLowerCase()));
  const now = new Set(newRelatedTexts.map((t) => t.toLowerCase()));

  for (const w of allWords) {
    if (w.id === currentWordId) continue;
    const key = w.word.trim().toLowerCase();
    const wasLinked = was.has(key);
    const isLinked = now.has(key);
    if (wasLinked === isLinked) continue;

    const currentList = parseRelatedWords(w.relatedWords ?? "");
    const hasCurrent = currentList.some((x) => x.toLowerCase() === currentWordText.toLowerCase());
    let updatedList = currentList;
    if (isLinked && !hasCurrent) {
      updatedList = [...currentList, currentWordText];
    } else if (!isLinked && hasCurrent) {
      updatedList = currentList.filter((x) => x.toLowerCase() !== currentWordText.toLowerCase());
    } else {
      continue;
    }

    await fetch(`/api/english/words/${w.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: w.word,
        senses: w.senses.map(toSenseInput),
        relatedWords: updatedList.join(", ") || null,
      }),
    });
  }
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

export function EditWordModal({ open, word, onClose, onDelete, startInEditMode, onOpenWord }: EditWordModalProps) {
  const { refetchWords, words: allWords } = useEnglishStudy();
  const [mode, setMode] = useState<"view" | "edit">(word ? "view" : "edit");
  const [wordText, setWordText] = useState("");
  const [senses, setSenses] = useState<SenseDraft[]>([{ ...emptySense }]);
  const [relatedWordsText, setRelatedWordsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [crawlData, setCrawlData] = useState<CambridgeCrawlData | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(word ? (startInEditMode ? "edit" : "view") : "edit");
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
      setRelatedWordsText(word.relatedWords ?? "");
    } else {
      setWordText("");
      setSenses([{ ...emptySense }]);
      setCrawlData(null);
      setRelatedWordsText("");
    }
  }, [open, word, startInEditMode]);

  function updateSense(i: number, patch: Partial<SenseDraft>) {
    setSenses((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addSense() {
    setSenses((prev) => [...prev, { ...emptySense }]);
  }

  function removeSense(i: number) {
    setSenses((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  // Fires when the user finishes typing the word (on blur): fills in just the
  // phonetic and part-of-speech for the first sense from the dictionary
  // lookup, so basic info shows up without needing "Tự động điền còn thiếu".
  // Never overwrites fields already filled in, and does nothing once both are set.
  async function handleAutoFillBasics() {
    if (!wordText.trim() || senses.length === 0) return;
    const needsPhonetic = !(senses[0].phonetic ?? "").trim();
    const needsPos = !(senses[0].partOfSpeech ?? "").trim();
    if (!needsPhonetic && !needsPos) return;
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
        }
      }
      const ipa = dict?.pronunciations?.find((p) => p.ipa)?.ipa;
      const partOfSpeech = dict?.senses?.[0]?.partOfSpeech;
      setSenses((prev) =>
        prev.map((s, i) =>
          i === 0
            ? { ...s, phonetic: s.phonetic || ipa || "", partOfSpeech: s.partOfSpeech || partOfSpeech || "" }
            : s
        )
      );
    } catch {
      // best-effort, ignore
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
        }
      }

      const synonymsText = (dict?.synonyms ?? []).slice(0, 6).join(", ");
      const antonymsText = (dict?.antonyms ?? []).slice(0, 6).join(", ");
      const ipa = dict?.pronunciations?.find((p) => p.ipa)?.ipa;

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
            partOfSpeech: s.partOfSpeech || match?.partOfSpeech || "",
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
      const newRelatedTexts = parseRelatedWords(relatedWordsText);
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
        relatedWords: newRelatedTexts.join(", ") || null,
        ...(word ? {} : { crawlData: crawlData ?? undefined }),
      };

      let savedId: number;
      const oldRelatedTexts = word ? parseRelatedWords(word.relatedWords ?? "") : [];

      if (word) {
        await fetch(`/api/english/words/${word.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        savedId = word.id;
      } else {
        const res = await fetch("/api/english/words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created = (await res.json()) as { id: number };
        savedId = created.id;
      }

      await syncRelatedWords(savedId, wordText.trim(), oldRelatedTexts, newRelatedTexts, allWords);
      await refetchWords();
      if (word) setMode("view");
      else onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    if (word) {
      // Revert any unsaved edits and go back to the read-only view rather
      // than closing the whole dialog.
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
      setRelatedWordsText(word.relatedWords ?? "");
      setMode("view");
    } else {
      onClose();
    }
  }

  const audioUrl = crawlData?.pronunciations?.find((p) => p.audioUrl)?.audioUrl;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl flex flex-col max-h-[88dvh]">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 min-w-0">
              <span className="truncate">{mode === "edit" ? (word ? "Sửa từ" : "Thêm từ mới") : wordText}</span>
              {mode === "view" && word && <PronounceButton word={wordText} audioUrl={audioUrl} />}
            </DialogTitle>
            {mode === "view" && word && (
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Sửa
                </Button>
                {onDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onDelete(word.id);
                      onClose();
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Xoá
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2 pr-1">
          {mode === "view" && word ? (
            <div className="space-y-4">
              {senses.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Chưa có nghĩa nào.</p>
              ) : (
                senses.map((s, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {s.partOfSpeech && (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium uppercase text-muted-foreground">
                          {s.partOfSpeech}
                        </span>
                      )}
                      {s.phonetic && <span className="text-xs text-muted-foreground">/{s.phonetic}/</span>}
                    </div>
                    {s.meaningVi && <p className="text-sm font-medium">{s.meaningVi}</p>}
                    {s.cambridgeMeaning && <p className="text-sm text-muted-foreground italic">{s.cambridgeMeaning}</p>}
                    {s.example && <p className="text-xs text-muted-foreground">&quot;{s.example}&quot;</p>}
                    {(s.synonyms || s.antonyms) && (
                      <p className="text-xs text-muted-foreground">
                        {s.synonyms && <>Đồng nghĩa: {s.synonyms} </>}
                        {s.antonyms && <>Trái nghĩa: {s.antonyms}</>}
                      </p>
                    )}
                  </div>
                ))
              )}
              {parseRelatedWords(relatedWordsText).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Từ liên quan:</span>
                  {parseRelatedWords(relatedWordsText).map((rw) => {
                    const match = allWords.find((w) => w.word.toLowerCase() === rw.toLowerCase());
                    const pos = abbreviatePos(match?.senses[0]?.partOfSpeech);
                    return match ? (
                      <button
                        key={rw}
                        onClick={() => onOpenWord?.(match.id)}
                        className="px-2 py-0.5 rounded-full bg-muted text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {rw}
                        {pos && <span className="text-muted-foreground"> ({pos})</span>}
                      </button>
                    ) : (
                      <span key={rw} className="px-2 py-0.5 rounded-full bg-muted/50 text-xs text-muted-foreground italic">
                        {rw}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Từ / cụm từ</label>
                <Input
                  value={wordText}
                  onChange={(e) => setWordText(e.target.value)}
                  onBlur={handleAutoFillBasics}
                  placeholder="vd: comprehensive"
                  autoFocus
                />
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input placeholder="Phiên âm (IPA)" value={s.phonetic ?? ""} onChange={(e) => updateSense(i, { phonetic: e.target.value })} />
                      <Input placeholder="Loại từ (noun, verb...)" value={s.partOfSpeech ?? ""} onChange={(e) => updateSense(i, { partOfSpeech: e.target.value })} />
                    </div>
                    <Textarea placeholder="Nghĩa Cambridge (tiếng Anh)" value={s.cambridgeMeaning ?? ""} onChange={(e) => updateSense(i, { cambridgeMeaning: e.target.value })} rows={2} />
                    <Textarea placeholder="Nghĩa tiếng Việt" value={s.meaningVi ?? ""} onChange={(e) => updateSense(i, { meaningVi: e.target.value })} rows={2} />
                    <Textarea placeholder="Ví dụ" value={s.example ?? ""} onChange={(e) => updateSense(i, { example: e.target.value })} rows={2} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Từ liên quan (phân cách bởi dấu phẩy)</label>
                <Input
                  value={relatedWordsText}
                  onChange={(e) => setRelatedWordsText(e.target.value)}
                  placeholder="vd: obese, overweight"
                />
                {(() => {
                  const already = new Set(parseRelatedWords(relatedWordsText).map((w) => w.toLowerCase()));
                  const suggestions = suggestRelatedWords(wordText, allWords, word?.id, already);
                  if (suggestions.length === 0) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Gợi ý:</span>
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            const current = parseRelatedWords(relatedWordsText);
                            setRelatedWordsText([...current, s].join(", "));
                          }}
                          className="px-2 py-0.5 rounded-full border border-dashed border-border text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <Plus className="w-2.5 h-2.5 inline mr-0.5" />{s}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {mode === "view" ? (
            <Button variant="ghost" onClick={onClose}>Đóng</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={handleCancelEdit}>Huỷ</Button>
              <Button onClick={handleSave} disabled={saving || !wordText.trim()}>
                {saving ? "Đang lưu..." : "Lưu"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
