"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/Dialog";
import { Plus, X, RefreshCw, Pencil, Trash2, ImagePlus } from "lucide-react";
import type { EnglishWord, EnglishSense } from "@/src/declaration/english";
import { useEnglishStudy } from "@/src/context/english";
import { PronounceButton } from "./PronounceButton";
import type { CambridgeCrawlData } from "./crawlData";
import { compressImage, imageUrl, uploadImage, type PendingImage } from "./imageUpload";
import { AltSpelling, ImageThumb, RelatedWordChips, WordSenseList, parseRelatedWords } from "./WordSenseDetail";
import { buildSensesFromDictionary, findMissingSenses, validateAndNormalizeWord } from "@/src/lib/english-autofill";

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

function toSenseInput(s: EnglishSense) {
  return {
    phonetic: s.phonetic || null,
    partOfSpeech: s.partOfSpeech || null,
    cambridgeMeaning: s.cambridgeMeaning || null,
    meaningVi: s.meaningVi || null,
    example: s.example || null,
    synonyms: s.synonyms || null,
    antonyms: s.antonyms || null,
    note: s.note || null,
    images: s.images ?? [],
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

type SenseDraft = Omit<EnglishSense, "id" | "sortOrder"> & { pendingImages?: PendingImage[]; imageLinkDraft?: string };

const emptySense: SenseDraft = {
  phonetic: "",
  partOfSpeech: "",
  cambridgeMeaning: "",
  meaningVi: "",
  example: "",
  synonyms: "",
  antonyms: "",
  note: "",
  images: [],
};

function toSenseDrafts(senses: EnglishSense[]): SenseDraft[] {
  if (senses.length === 0) return [{ ...emptySense }];
  return senses.map((s) => ({
    phonetic: s.phonetic ?? "",
    partOfSpeech: s.partOfSpeech ?? "",
    cambridgeMeaning: s.cambridgeMeaning ?? "",
    meaningVi: s.meaningVi ?? "",
    example: s.example ?? "",
    synonyms: s.synonyms ?? "",
    antonyms: s.antonyms ?? "",
    note: s.note ?? "",
    images: s.images ?? [],
  }));
}

function hasContent(s: SenseDraft): boolean {
  if ((s.images?.length ?? 0) > 0 || (s.pendingImages?.length ?? 0) > 0) return true;
  return [s.phonetic, s.partOfSpeech, s.cambridgeMeaning, s.meaningVi, s.example, s.synonyms, s.antonyms, s.note].some((v) => v?.trim());
}

export function EditWordModal({ open, word, onClose, onDelete, startInEditMode, onOpenWord }: EditWordModalProps) {
  const t = useTranslations("English");
  const { refetchWords, words: allWords } = useEnglishStudy();
  const [mode, setMode] = useState<"view" | "edit">(word ? "view" : "edit");
  const [wordText, setWordText] = useState("");
  const [senses, setSenses] = useState<SenseDraft[]>([{ ...emptySense }]);
  const [relatedWordsText, setRelatedWordsText] = useState("");
  const [altSpelling, setAltSpelling] = useState("");
  const [saving, setSaving] = useState(false);
  const [crawlData, setCrawlData] = useState<CambridgeCrawlData | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillError, setAutoFillError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setAutoFillError(null);
    setMode(word ? (startInEditMode ? "edit" : "view") : "edit");
    if (word) {
      setWordText(word.word);
      setSenses(toSenseDrafts(word.senses));
      setCrawlData((word.crawlData as CambridgeCrawlData | undefined) ?? null);
      setRelatedWordsText(word.relatedWords ?? "");
      setAltSpelling(word.altSpelling ?? "");
    } else {
      setWordText("");
      setSenses([{ ...emptySense }]);
      setCrawlData(null);
      setRelatedWordsText("");
      setAltSpelling("");
    }
  }, [open, word, startInEditMode]);

  function updateSense(i: number, patch: Partial<SenseDraft>) {
    setSenses((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function loadDict(): Promise<CambridgeCrawlData | null> {
    if (crawlData) return crawlData;
    if (!wordText.trim()) return null;
    const params = new URLSearchParams();
    if (word) params.set("wordId", String(word.id));
    else params.set("word", wordText.trim());
    const res = await fetch(`/api/english/crawl?${params.toString()}`);
    const data = (await res.json()) as { crawlData?: CambridgeCrawlData; error?: string };
    if (data.crawlData) setCrawlData(data.crawlData);
    return data.crawlData ?? null;
  }

  async function addSense() {
    const known = senses.find((s) => s.phonetic?.trim())?.phonetic ?? "";
    setSenses((prev) => [...prev, { ...emptySense, phonetic: known }]);
    if (known) return;
    try {
      const ipa = (await loadDict())?.pronunciations?.find((p) => p.ipa)?.ipa;
      if (ipa) setSenses((prev) => prev.map((s) => (s.phonetic ? s : { ...s, phonetic: ipa })));
    } catch {}
  }

  function removeSense(i: number) {
    setSenses((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function handleAddImages(i: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    const added = await Promise.all(
      Array.from(files).map(async (f) => {
        const blob = await compressImage(f);
        return { blob, previewUrl: URL.createObjectURL(blob) };
      })
    );
    setSenses((prev) => prev.map((s, idx) => (idx === i ? { ...s, pendingImages: [...(s.pendingImages ?? []), ...added] } : s)));
  }

  function removePendingImage(i: number, img: PendingImage) {
    URL.revokeObjectURL(img.previewUrl);
    setSenses((prev) => prev.map((s, idx) => (idx === i ? { ...s, pendingImages: s.pendingImages?.filter((p) => p !== img) } : s)));
  }

  function addImageLink(i: number) {
    const url = senses[i].imageLinkDraft?.trim();
    if (!url || !/^https?:\/\//i.test(url)) return;
    setSenses((prev) => prev.map((s, idx) => (idx === i ? { ...s, imageLinkDraft: "", pendingImages: [...(s.pendingImages ?? []), { url, previewUrl: url }] } : s)));
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
      const dict = await loadDict();
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

  // Same pipeline as the browser extension's quick-add: validates/normalizes
  // the word, crawls the dictionary, lets Groq pick common senses and write
  // a short Vietnamese gloss (not a literal translation), and falls back to
  // a fully AI-generated definition when the dictionary has nothing at all.
  // - New word (no existing rows with content yet): replaces the empty
  //   placeholder row(s) with the full set of senses found.
  // - Existing word: only APPENDS senses that are semantically missing from
  //   what's already saved (never re-adds a rephrased duplicate); does not
  //   backfill blanks in already-present rows.
  async function handleAutoFillAll() {
    const raw = wordText.trim();
    if (!raw) return;
    setAutoFilling(true);
    setAutoFillError(null);
    try {
      const check = await validateAndNormalizeWord(raw);
      if (!check.valid) {
        setAutoFillError(check.reason);
        return;
      }
      if (check.normalized !== raw) setWordText(check.normalized);

      if (word) {
        const missing = await findMissingSenses(
          check.normalized,
          senses.filter(hasContent).map((s) => ({ partOfSpeech: s.partOfSpeech, cambridgeMeaning: s.cambridgeMeaning, meaningVi: s.meaningVi }))
        );
        if (missing.length === 0) {
          setAutoFillError("Không có nghĩa nào còn thiếu so với từ điển.");
          return;
        }
        setSenses((prev) => [...prev.filter(hasContent), ...missing.map((m) => ({ ...m, images: [] }))]);
      } else {
        const built = await buildSensesFromDictionary(check.normalized);
        const builtDrafts = built.map((m) => ({ ...m, images: [] }));
        setSenses((prev) => {
          const wasUntouched = prev.length === 1 && !hasContent(prev[0]);
          return wasUntouched ? builtDrafts : [...prev, ...builtDrafts];
        });
      }
    } catch (err) {
      setAutoFillError(err instanceof Error ? err.message : String(err));
    } finally {
      setAutoFilling(false);
    }
  }

  async function handleSave() {
    if (!wordText.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const newRelatedTexts = parseRelatedWords(relatedWordsText);
      let uploadedSenses: SenseDraft[];
      try {
        uploadedSenses = await Promise.all(
          senses.filter(hasContent).map(async (s) => ({
            ...s,
            images: [...(s.images ?? []), ...(await Promise.all((s.pendingImages ?? []).map((p) => uploadImage(p))))],
          }))
        );
      } catch {
        setSaveError(t("EditWord.uploadError"));
        return;
      }
      const payload = {
        word: wordText.trim(),
        senses: uploadedSenses.map(toSenseInput),
        relatedWords: newRelatedTexts.join(", ") || null,
        altSpelling: altSpelling.trim() || null,
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

      senses.forEach((s) => s.pendingImages?.forEach((p) => URL.revokeObjectURL(p.previewUrl)));
      setSenses(uploadedSenses.length > 0 ? uploadedSenses.map(({ pendingImages: _, imageLinkDraft: __, ...s }) => s) : [{ ...emptySense }]);
      await syncRelatedWords(savedId, wordText.trim(), oldRelatedTexts, newRelatedTexts, allWords);
      await refetchWords();
      if (word) setMode("view");
      else onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    senses.forEach((s) => s.pendingImages?.forEach((p) => URL.revokeObjectURL(p.previewUrl)));
    if (word) {
      // Revert any unsaved edits and go back to the read-only view rather
      // than closing the whole dialog.
      setWordText(word.word);
      setSenses(toSenseDrafts(word.senses));
      setRelatedWordsText(word.relatedWords ?? "");
      setAltSpelling(word.altSpelling ?? "");
      setSaveError(null);
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
              <span className="truncate">{mode === "edit" ? (word ? t("EditWord.editTitle") : t("EditWord.addTitle")) : wordText}</span>
              {mode === "view" && <AltSpelling value={altSpelling} className="text-base" />}
              {mode === "view" && word && <PronounceButton word={wordText} audioUrl={audioUrl} />}
            </DialogTitle>
            {mode === "view" && word && (
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> {t("EditWord.edit")}
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
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> {t("EditWord.delete")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2 pr-1">
          {mode === "view" && word ? (
            <div className="space-y-4">
              <WordSenseList senses={senses} />
              <RelatedWordChips relatedWords={relatedWordsText} allWords={allWords} onOpenWord={onOpenWord ?? (() => {})} />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("EditWord.word")}</label>
                <Input
                  value={wordText}
                  onChange={(e) => setWordText(e.target.value)}
                  onBlur={handleAutoFillBasics}
                  placeholder="vd: comprehensive"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("EditWord.altSpelling")}</label>
                <Input value={altSpelling} onChange={(e) => setAltSpelling(e.target.value)} placeholder="vd: mold" />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("EditWord.senses")}</p>
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
                      <Input placeholder={t("EditWord.phonetic")} value={s.phonetic ?? ""} onChange={(e) => updateSense(i, { phonetic: e.target.value })} />
                      <Input placeholder={t("EditWord.partOfSpeech")} value={s.partOfSpeech ?? ""} onChange={(e) => updateSense(i, { partOfSpeech: e.target.value })} />
                    </div>
                    <Textarea placeholder={t("EditWord.cambridgeMeaning")} value={s.cambridgeMeaning ?? ""} onChange={(e) => updateSense(i, { cambridgeMeaning: e.target.value })} rows={2} />
                    <Textarea placeholder={t("EditWord.meaningVi")} value={s.meaningVi ?? ""} onChange={(e) => updateSense(i, { meaningVi: e.target.value })} rows={2} />
                    <Textarea placeholder={t("EditWord.example")} value={s.example ?? ""} onChange={(e) => updateSense(i, { example: e.target.value })} rows={2} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input placeholder={t("EditWord.synonyms")} value={s.synonyms ?? ""} onChange={(e) => updateSense(i, { synonyms: e.target.value })} />
                      <Input placeholder={t("EditWord.antonyms")} value={s.antonyms ?? ""} onChange={(e) => updateSense(i, { antonyms: e.target.value })} />
                    </div>
                    <Textarea placeholder={t("EditWord.note")} value={s.note ?? ""} onChange={(e) => updateSense(i, { note: e.target.value })} rows={2} />
                    <div className="flex flex-wrap gap-2">
                      {(s.images ?? []).map((key) => (
                        <ImageThumb key={key} src={imageUrl(key)} onRemove={() => updateSense(i, { images: s.images?.filter((k) => k !== key) })} />
                      ))}
                      {(s.pendingImages ?? []).map((p) => (
                        <ImageThumb key={p.previewUrl} src={p.previewUrl} onRemove={() => removePendingImage(i, p)} />
                      ))}
                      <label className="w-20 h-20 shrink-0 rounded-md border border-dashed border-border flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors">
                        <ImagePlus className="w-4 h-4" />
                        {t("EditWord.addImage")}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            void handleAddImages(i, e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("EditWord.imageLinkPlaceholder")}
                        value={s.imageLinkDraft ?? ""}
                        onChange={(e) => updateSense(i, { imageLinkDraft: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addImageLink(i);
                          }
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => addImageLink(i)} disabled={!s.imageLinkDraft?.trim()}>
                        {t("EditWord.addImageLink")}
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addSense}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> {t("EditWord.addSense")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleAutoFillAll} disabled={autoFilling || !wordText.trim()}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${autoFilling ? "animate-spin" : ""}`} />
                    {autoFilling ? t("EditWord.autoFilling") : t("Common.autoFill")}
                  </Button>
                </div>
                {autoFillError && <p className="text-xs text-destructive">{autoFillError}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("EditWord.relatedWords")}</label>
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
                      <span className="text-xs text-muted-foreground">{t("EditWord.suggestions")}</span>
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

        {mode !== "view" && (
          <DialogFooter>
            {saveError && <p className="text-xs text-destructive self-center mr-auto">{saveError}</p>}
            <Button variant="ghost" onClick={handleCancelEdit}>{t("Common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !wordText.trim()}>
              {saving ? t("Common.saving") : t("Common.save")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
