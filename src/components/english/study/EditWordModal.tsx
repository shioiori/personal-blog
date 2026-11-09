"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import {
  backfillIncompleteSenses,
  buildSensesFromDictionary,
  checkDuplicateWord,
  findMissingSenses,
  suggestRelatedWordEntries,
  validateAndNormalizeWord,
  type RelatedWordEntry,
} from "@/src/lib/english-autofill";

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

// Mirrors the server's own normalization (src/lib/english-db.ts) closely
// enough to match a word's sourceUrl against an auto-created source group's
// stored URL — strips the hash fragment, falls back to the raw string if
// it isn't a parseable URL.
function normalizeSourceUrlClient(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url.trim();
  }
}

function hasContent(s: SenseDraft): boolean {
  if ((s.images?.length ?? 0) > 0 || (s.pendingImages?.length ?? 0) > 0) return true;
  return [s.phonetic, s.partOfSpeech, s.cambridgeMeaning, s.meaningVi, s.example, s.synonyms, s.antonyms, s.note].some((v) => v?.trim());
}

export function EditWordModal({ open, word, onClose, onDelete, startInEditMode, onOpenWord }: EditWordModalProps) {
  const t = useTranslations("English");
  const { refetchWords, words: allWords, groups, refetchGroups } = useEnglishStudy();
  const [mode, setMode] = useState<"view" | "edit">(word ? "view" : "edit");
  const [wordText, setWordText] = useState("");
  const [senses, setSenses] = useState<SenseDraft[]>([{ ...emptySense }]);
  const [relatedWordsText, setRelatedWordsText] = useState("");
  const [altSpelling, setAltSpelling] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set());
  const [newCategoryDraft, setNewCategoryDraft] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [crawlData, setCrawlData] = useState<CambridgeCrawlData | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillError, setAutoFillError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [relatedSuggestions, setRelatedSuggestions] = useState<RelatedWordEntry[] | null>(null);
  const [relatedSelected, setRelatedSelected] = useState<Set<string>>(new Set());
  const [relatedSuggesting, setRelatedSuggesting] = useState(false);
  const [relatedAdding, setRelatedAdding] = useState(false);
  // Set when this (new) word was prefilled from another user's identical
  // word (see resolveExisting below). `originBaseline` is a snapshot of what
  // was prefilled, used at save time to tell whether the user changed
  // anything: unchanged -> save as a live reference to that word; edited ->
  // save as an independent copy with the edits (see handleSave).
  const [originWordId, setOriginWordId] = useState<number | null>(null);
  const [originBaseline, setOriginBaseline] = useState<{ word: string; senses: string; relatedWords: string; altSpelling: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setAutoFillError(null);
    setRelatedSuggestions(null);
    setRelatedSelected(new Set());
    setMode(word ? (startInEditMode ? "edit" : "view") : "edit");
    if (word) {
      setWordText(word.word);
      setSenses(toSenseDrafts(word.senses));
      setCrawlData((word.crawlData as CambridgeCrawlData | undefined) ?? null);
      setRelatedWordsText(word.relatedWords ?? "");
      setAltSpelling(word.altSpelling ?? "");
      setSourceUrl(word.sourceUrl ?? "");
      setSelectedGroupIds(new Set(word.groupIds ?? []));
    } else {
      setWordText("");
      setSenses([{ ...emptySense }]);
      setCrawlData(null);
      setRelatedWordsText("");
      setAltSpelling("");
      setSourceUrl("");
      setSelectedGroupIds(new Set());
    }
    setNewCategoryDraft("");
    setOriginWordId(null);
    setOriginBaseline(null);
  }, [open, word, startInEditMode]);

  // The group auto-created for the word's current sourceUrl, if any — a word
  // can never have a sourceUrl without belonging to that group (also
  // enforced server-side in updateWord/createWord), so this chip is locked on.
  const sourceGroupId = (() => {
    const url = sourceUrl.trim();
    if (!url) return null;
    const normalized = normalizeSourceUrlClient(url);
    return groups.find((g) => g.sourceUrl && normalizeSourceUrlClient(g.sourceUrl) === normalized)?.id ?? null;
  })();

  function toggleGroupSelected(id: number) {
    if (id === sourceGroupId) return; // locked on while sourceUrl matches it
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateCategory() {
    const name = newCategoryDraft.trim();
    if (!name) return;
    setCreatingCategory(true);
    try {
      const res = await fetch("/api/english/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const created = (await res.json()) as { id: number };
      await refetchGroups();
      if (created?.id) setSelectedGroupIds((prev) => new Set(prev).add(created.id));
      setNewCategoryDraft("");
    } finally {
      setCreatingCategory(false);
    }
  }

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
  // - Existing word: APPENDS senses that are semantically missing from what's
  //   already saved (never re-adds a rephrased duplicate), and separately
  //   backfills blank meaningVi/example on already-present rows that have a
  //   cambridgeMeaning but are missing one — never overwrites a non-blank field.
  async function handleAutoFillAll() {
    const raw = wordText.trim();
    if (!raw) return;
    setAutoFilling(true);
    setAutoFillError(null);
    try {
      // Cheap, non-AI check first — skip the whole AI pipeline (lemmatize +
      // gloss/ai-define) entirely on an exact repeat add.
      const resolveExisting = async (text: string) => {
        const dup = await checkDuplicateWord(text, null, "fill");
        if (dup.exists) {
          const message = t("EditWord.duplicateWord", { word: dup.word ?? text });
          toast.error(message);
          setAutoFillError(message);
          return true;
        }
        if (!dup.source) return false;
        const src = dup.source;
        const drafts = toSenseDrafts(src.senses);
        const wasUntouched = senses.length === 1 && !hasContent(senses[0]) && !relatedWordsText && !altSpelling;
        setWordText(src.word);
        setSenses((prev) => (prev.length === 1 && !hasContent(prev[0]) ? drafts : [...prev, ...drafts]));
        setRelatedWordsText((prev) => prev || src.relatedWords || "");
        setAltSpelling((prev) => prev || src.altSpelling || "");
        setCrawlData((prev) => prev ?? ((src.crawlData as CambridgeCrawlData | undefined) ?? null));
        // Only treat this as a potential reference when nothing but the
        // autofilled source went into the form — if the user had already
        // typed senses of their own, this save was always going to be an
        // independent word regardless of what resolveExisting adds.
        if (wasUntouched && dup.originWordId) {
          setOriginWordId(dup.originWordId);
          setOriginBaseline({
            word: src.word,
            senses: JSON.stringify(drafts.map(toSenseInput)),
            relatedWords: src.relatedWords || "",
            altSpelling: src.altSpelling || "",
          });
        }
        return true;
      };

      if (!word && (await resolveExisting(raw))) return;

      const check = await validateAndNormalizeWord(raw);
      if (!check.valid) {
        setAutoFillError(check.reason);
        return;
      }
      if (check.normalized !== raw) setWordText(check.normalized);

      // Normalization can reveal a duplicate the raw-text check missed (e.g.
      // "went up" -> "go up" already exists) — check again before the
      // heavier gloss/ai-define calls.
      if (!word && check.normalized.toLowerCase() !== raw.toLowerCase() && (await resolveExisting(check.normalized))) return;

      if (word) {
        const contentEntries = senses.map((s, i) => ({ s, i })).filter((x) => hasContent(x.s));

        const [missing, backfill] = await Promise.all([
          findMissingSenses(
            check.normalized,
            contentEntries.map((x) => ({ partOfSpeech: x.s.partOfSpeech, cambridgeMeaning: x.s.cambridgeMeaning, meaningVi: x.s.meaningVi }))
          ),
          backfillIncompleteSenses(
            check.normalized,
            contentEntries.map((x) => ({
              index: x.i,
              partOfSpeech: x.s.partOfSpeech,
              cambridgeMeaning: x.s.cambridgeMeaning,
              meaningVi: x.s.meaningVi,
              example: x.s.example,
            }))
          ),
        ]);

        if (missing.length === 0 && backfill.length === 0) {
          setAutoFillError("Không có nghĩa nào còn thiếu so với từ điển.");
          return;
        }

        setSenses((prev) => {
          const patched = prev.map((s, i) => {
            const patch = backfill.find((b) => b.index === i);
            if (!patch) return s;
            return {
              ...s,
              meaningVi: s.meaningVi?.trim() ? s.meaningVi : patch.meaningVi ?? s.meaningVi,
              example: s.example?.trim() ? s.example : patch.example ?? s.example,
            };
          });
          return [...patched.filter(hasContent), ...missing.map((m) => ({ ...m, images: [] }))];
        });
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

  // AI-only (no dictionary crawl) suggestion of same-word-family related
  // words (verb/noun/adj/phrase forms), each with a full ready-to-save entry.
  // Purely additive and opt-in: nothing is saved until the user ticks a
  // checkbox and presses "add selected" — mirrors how the manual add-word
  // flow always leaves the save step to the user.
  async function handleSuggestRelated() {
    const raw = wordText.trim();
    if (!raw) return;
    setRelatedSuggesting(true);
    setRelatedSuggestions(null);
    try {
      const entries = await suggestRelatedWordEntries(raw, senses[0]?.partOfSpeech ?? "");
      setRelatedSuggestions(entries);
      setRelatedSelected(new Set(entries.filter((e) => !e.isExisting).map((e) => e.word)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRelatedSuggesting(false);
    }
  }

  function toggleRelatedSelected(word: string) {
    setRelatedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }

  async function handleAddSelectedRelated() {
    if (!relatedSuggestions) return;
    const toAdd = relatedSuggestions.filter((e) => !e.isExisting && relatedSelected.has(e.word));
    if (toAdd.length === 0) return;
    setRelatedAdding(true);
    try {
      const mainWord = wordText.trim();
      for (const entry of toAdd) {
        // Link back to the main word AND to every sibling being added in
        // this same batch — not just a star pointing at the main word —
        // so e.g. "concentrate" and "concentration" end up pointing at each
        // other too, not only both pointing at "concentrated".
        const linkedWords = [mainWord, ...toAdd.filter((o) => o !== entry).map((o) => o.word)].join(", ");
        await fetch("/api/english/words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: entry.word,
            senses: entry.senses.map((s) => ({
              phonetic: s.phonetic || null,
              partOfSpeech: s.partOfSpeech || null,
              cambridgeMeaning: s.cambridgeMeaning || null,
              meaningVi: s.meaningVi || null,
              example: s.example || null,
              synonyms: s.synonyms || null,
              antonyms: s.antonyms || null,
              note: s.note || null,
              images: [],
            })),
            relatedWords: linkedWords,
          }),
        });
      }
      // The main word (not saved yet — this panel only exists in create
      // mode) also needs the reverse link once it IS saved, so fold the
      // newly-added words into its own related-words field right away.
      setRelatedWordsText((prev) => {
        const existing = parseRelatedWords(prev);
        const already = new Set(existing.map((w) => w.toLowerCase()));
        const additions = toAdd.map((e) => e.word).filter((w) => !already.has(w.toLowerCase()));
        return [...existing, ...additions].join(", ");
      });
      await refetchWords();
      setRelatedSuggestions((prev) => prev?.filter((e) => !toAdd.includes(e)) ?? null);
      setRelatedSelected(new Set());
      toast.success(t("EditWord.relatedAiAddSelected", { count: toAdd.length }));
    } finally {
      setRelatedAdding(false);
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
      // A new word prefilled from another user's identical word: if nothing
      // was changed since the prefill, save it as a live reference (no sense
      // rows of our own — origin's future edits stay visible); otherwise it
      // forks into an independent copy that keeps our edits plus the
      // (now purely informational) origin link.
      const isUntouchedReference =
        !word &&
        originWordId !== null &&
        originBaseline !== null &&
        wordText.trim() === originBaseline.word &&
        JSON.stringify(uploadedSenses.map(toSenseInput)) === originBaseline.senses &&
        (newRelatedTexts.join(", ") || "") === originBaseline.relatedWords &&
        altSpelling.trim() === originBaseline.altSpelling;

      const payload = {
        word: wordText.trim(),
        senses: isUntouchedReference ? [] : uploadedSenses.map(toSenseInput),
        relatedWords: newRelatedTexts.join(", ") || null,
        altSpelling: altSpelling.trim() || null,
        sourceUrl: sourceUrl.trim() || null,
        ...(word ? {} : { crawlData: crawlData ?? undefined, originWordId }),
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
      setOriginWordId(null);
      setOriginBaseline(null);
      await syncRelatedWords(savedId, wordText.trim(), oldRelatedTexts, newRelatedTexts, allWords);

      const oldGroupIds = new Set(word?.groupIds ?? []);
      const effectiveSelected = new Set(selectedGroupIds);
      if (sourceGroupId) effectiveSelected.add(sourceGroupId); // locked on, see sourceGroupId above
      const added = [...effectiveSelected].filter((id) => !oldGroupIds.has(id));
      const removed = [...oldGroupIds].filter((id) => !effectiveSelected.has(id) && id !== sourceGroupId);
      await Promise.all([
        ...added.map((groupId) =>
          fetch(`/api/english/groups/${groupId}/words`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wordIds: [savedId] }),
          })
        ),
        ...removed.map((groupId) =>
          fetch(`/api/english/groups/${groupId}/words`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wordId: savedId }),
          })
        ),
      ]);
      if (added.length > 0 || removed.length > 0) await refetchGroups();

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
      setSourceUrl(word.sourceUrl ?? "");
      setSelectedGroupIds(new Set(word.groupIds ?? []));
      setNewCategoryDraft("");
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
              <WordSenseList senses={senses} allWords={allWords} onOpenWord={onOpenWord} />
              <RelatedWordChips relatedWords={relatedWordsText} allWords={allWords} onOpenWord={onOpenWord ?? (() => {})} />
              {word.sourceUrl && (
                <p className="text-xs text-muted-foreground truncate">
                  {t("EditWord.sourceUrl")}:{" "}
                  <a href={word.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                    {word.sourceUrl}
                  </a>
                </p>
              )}
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("EditWord.sourceUrl")}</label>
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("EditWord.categories")}</label>
                {groups.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("EditWord.noCategoriesYet")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {groups.map((g) => {
                      const locked = g.id === sourceGroupId;
                      const active = locked || selectedGroupIds.has(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGroupSelected(g.id)}
                          disabled={locked}
                          title={locked ? t("EditWord.categoryLockedBySource") : undefined}
                          className={`px-2 py-0.5 rounded-full border text-xs transition-colors ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-dashed border-border hover:bg-accent hover:text-accent-foreground"
                          } ${locked ? "cursor-not-allowed opacity-90" : ""}`}
                        >
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={newCategoryDraft}
                    onChange={(e) => setNewCategoryDraft(e.target.value)}
                    placeholder={t("EditWord.newCategoryPlaceholder")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCreateCategory();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleCreateCategory} disabled={creatingCategory || !newCategoryDraft.trim()}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> {t("Groups.createShort")}
                  </Button>
                </div>
              </div>

              {!word && (
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={handleSuggestRelated} disabled={relatedSuggesting || !wordText.trim()}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${relatedSuggesting ? "animate-spin" : ""}`} />
                    {relatedSuggesting ? t("EditWord.suggestingRelatedAi") : t("EditWord.suggestRelatedAi")}
                  </Button>
                  {relatedSuggestions && relatedSuggestions.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t("EditWord.relatedAiEmpty")}</p>
                  )}
                  {relatedSuggestions && relatedSuggestions.length > 0 && (
                    <div className="space-y-2">
                      {relatedSuggestions.map((entry) => (
                        <label
                          key={entry.word}
                          className={`flex items-start gap-2 rounded-lg border border-border p-2 text-sm ${entry.isExisting ? "opacity-50" : "cursor-pointer hover:bg-accent/50"}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            disabled={entry.isExisting}
                            checked={relatedSelected.has(entry.word)}
                            onChange={() => toggleRelatedSelected(entry.word)}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium">{entry.word}</span>
                              <span className="text-xs text-muted-foreground">({entry.pos})</span>
                              {entry.isExisting && (
                                <span className="text-xs text-muted-foreground italic">{t("EditWord.relatedAiAlreadyExists")}</span>
                              )}
                            </div>
                            {entry.senses.map((s, i) => (
                              <p key={i} className="text-xs text-muted-foreground truncate">{s.meaningVi}</p>
                            ))}
                          </div>
                        </label>
                      ))}
                      <Button size="sm" onClick={handleAddSelectedRelated} disabled={relatedAdding || relatedSelected.size === 0}>
                        {t("EditWord.relatedAiAddSelected", { count: relatedSelected.size })}
                      </Button>
                    </div>
                  )}
                </div>
              )}
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
