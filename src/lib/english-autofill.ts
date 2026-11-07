import type { CambridgeCrawlData } from "@/src/components/english/study/crawlData";

// Shared autofill pipeline for word-add, used by both the EditWordModal (web
// app) and the browser extension's quick-add — ported from the extension's
// shared.js so both sides behave identically: validate the input, crawl the
// dictionary, let Groq pick common senses + write a short Vietnamese gloss
// (not a literal translation), and fall back to a fully AI-generated
// definition when neither dictionaryapi.dev nor its Wiktionary fallback has
// anything at all.

export interface AutofillSense {
  phonetic: string;
  partOfSpeech: string;
  cambridgeMeaning: string;
  meaningVi: string;
  example: string;
  synonyms: string;
  antonyms: string;
  note: string;
}

export interface ExistingSenseForDedup {
  partOfSpeech?: string | null;
  cambridgeMeaning?: string | null;
  meaningVi?: string | null;
}

function emptySense(): AutofillSense {
  return { phonetic: "", partOfSpeech: "", cambridgeMeaning: "", meaningVi: "", example: "", synonyms: "", antonyms: "", note: "" };
}

function normalizeForDedup(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) {
    let msg = "HTTP " + res.status;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}

// Validates the selected text (rejects blank/gibberish, non-English, or a
// full sentence rather than a word/idiom/phrasal verb) and, if valid,
// normalizes an inflected word ("depends" -> "depend"). Fails closed on any
// error — better to block than to risk saving something that violates the
// rules unchecked.
export async function validateAndNormalizeWord(
  wordText: string
): Promise<{ valid: true; normalized: string } | { valid: false; reason: string }> {
  try {
    const res = await apiFetch<{ valid?: boolean; normalized?: string; reason?: string }>("/api/english/lemmatize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: wordText }),
    });
    if (res?.valid) {
      return { valid: true, normalized: res.normalized?.trim() || wordText };
    }
    return { valid: false, reason: res?.reason || "Không hợp lệ để thêm vào từ điển." };
  } catch (err) {
    return { valid: false, reason: "Không kiểm tra được, thử lại sau: " + (err instanceof Error ? err.message : String(err)) };
  }
}

export interface DuplicateCheckResult {
  exists: boolean;
  id?: number;
  word?: string;
}

// Cheap, non-AI check — call before validateAndNormalizeWord/buildSensesFromDictionary
// so an exact (or near-exact) repeat add never spends any AI tokens.
export async function checkDuplicateWord(wordText: string): Promise<DuplicateCheckResult> {
  try {
    return await apiFetch<DuplicateCheckResult>(`/api/english/words/exists?word=${encodeURIComponent(wordText)}`);
  } catch {
    return { exists: false };
  }
}

interface FlatDef {
  partOfSpeech: string;
  text: string;
  example: string;
}

function flattenDictDefs(dict: CambridgeCrawlData | null | undefined): FlatDef[] {
  const flatDefs: FlatDef[] = [];
  const seen = new Set<string>();
  for (const sense of dict?.senses ?? []) {
    for (const def of sense.definitions ?? []) {
      if (!def.text) continue;
      const key = normalizeForDedup(def.text);
      if (seen.has(key)) continue;
      seen.add(key);
      flatDefs.push({ partOfSpeech: sense.partOfSpeech || "", text: def.text, example: def.examples?.[0] || "" });
    }
  }
  return flatDefs;
}

interface CrawlResult {
  flatDefs: FlatDef[];
  ipa: string;
  synonyms: string;
  antonyms: string;
}

// dictionaryapi.dev sometimes answers with an entry that has a part of
// speech but an EMPTY definitions list. Try once more before giving up.
async function crawlAndDedupe(wordText: string, attempt = 0): Promise<CrawlResult | null> {
  const params = new URLSearchParams({ word: wordText });
  const data = await apiFetch<{ crawlData?: CambridgeCrawlData }>(`/api/english/crawl?${params.toString()}`);
  const dict = data?.crawlData;
  if (!dict) return null;

  const flatDefs = flattenDictDefs(dict);
  if (flatDefs.length === 0 && attempt === 0) {
    return crawlAndDedupe(wordText, 1);
  }

  return {
    flatDefs,
    ipa: dict.pronunciations?.find((p) => p.ipa)?.ipa || "",
    synonyms: (dict.synonyms ?? []).join(", "),
    antonyms: (dict.antonyms ?? []).join(", "),
  };
}

interface GlossPick {
  index: number;
  meaningVi: string;
  example?: string;
}

function buildSenseRows(picks: GlossPick[], flatDefs: FlatDef[], ipa: string, synonyms: string, antonyms: string): AutofillSense[] {
  const rows: AutofillSense[] = [];
  for (const p of picks) {
    const def = flatDefs[p.index];
    if (!def) continue;
    rows.push({
      ...emptySense(),
      // Pronunciation is a property of the word itself, not of one
      // particular sense — fill it on every row. Synonyms/antonyms are
      // only put on the first row, same as the extension, to avoid
      // repeating the same list across every sense.
      phonetic: ipa,
      partOfSpeech: def.partOfSpeech,
      cambridgeMeaning: def.text,
      meaningVi: p.meaningVi,
      example: p.example || def.example,
      synonyms: rows.length === 0 ? synonyms : "",
      antonyms: rows.length === 0 ? antonyms : "",
    });
  }
  return rows;
}

const AI_DEFINE_NOTE = "Định nghĩa do AI tạo (không tìm thấy trong từ điển) — nên kiểm tra lại.";

// Last resort when NEITHER dictionaryapi.dev nor the Wiktionary fallback has
// anything — e.g. an uncommon phrasal verb like "creep into". The model is
// never asked for phonetic — `knownIpa` (the real dictionary pronunciation,
// if any was found) is the only source; left blank otherwise. Throws if the
// model isn't confident this is even a real word/phrase.
async function aiDefineFallback(wordText: string, knownIpa: string): Promise<AutofillSense[]> {
  const res = await apiFetch<{ senses?: Partial<AutofillSense>[] }>("/api/english/ai-define", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word: wordText }),
  });
  const senses = res?.senses ?? [];
  if (senses.length === 0) {
    throw new Error(`Không tìm thấy định nghĩa nào cho "${wordText}", kể cả từ AI. Thử lại sau hoặc thêm thủ công.`);
  }
  return senses.map((s) => ({ ...emptySense(), ...s, phonetic: knownIpa, note: s.note || AI_DEFINE_NOTE }));
}

// Crawls the dictionary, sends every deduped definition to /api/english/gloss
// (which picks the common senses and writes a short Vietnamese gloss for
// each), and returns ready-to-save sense rows. Falls back to AI-only
// definition if the dictionary itself has nothing usable.
export async function buildSensesFromDictionary(wordText: string): Promise<AutofillSense[]> {
  const crawl = await crawlAndDedupe(wordText);
  if (!crawl || crawl.flatDefs.length === 0) return aiDefineFallback(wordText, crawl?.ipa ?? "");
  const { flatDefs, ipa, synonyms, antonyms } = crawl;

  let picks: GlossPick[] = [];
  try {
    const res = await apiFetch<{ senses?: GlossPick[] }>("/api/english/gloss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: wordText,
        items: flatDefs.map((d) => ({ partOfSpeech: d.partOfSpeech, definition: d.text, example: d.example })),
      }),
    });
    picks = res?.senses ?? [];
  } catch {
    // best effort, fall through to the raw-definitions fallback below
  }
  if (picks.length === 0) picks = flatDefs.slice(0, 6).map((_, i) => ({ index: i, meaningVi: "" }));

  const built = buildSenseRows(picks, flatDefs, ipa, synonyms, antonyms);
  return built.length > 0 ? built : [{ ...emptySense(), phonetic: ipa }];
}

// Used when the word already exists: asks the gloss endpoint to semantically
// dedup crawled definitions against `existingSenses`, and returns rows only
// for senses that are genuinely new. An empty array legitimately means
// "nothing missing" — never falls back to raw definitions on that.
export async function findMissingSenses(wordText: string, existingSenses: ExistingSenseForDedup[]): Promise<AutofillSense[]> {
  const crawl = await crawlAndDedupe(wordText);
  if (!crawl || crawl.flatDefs.length === 0) return [];
  const { flatDefs } = crawl;

  const res = await apiFetch<{ senses?: GlossPick[] }>("/api/english/gloss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      word: wordText,
      items: flatDefs.map((d) => ({ partOfSpeech: d.partOfSpeech, definition: d.text, example: d.example })),
      existingSenses: existingSenses.map((s) => ({
        partOfSpeech: s.partOfSpeech,
        cambridgeMeaning: s.cambridgeMeaning,
        meaningVi: s.meaningVi,
      })),
    }),
  });
  const picks = res?.senses ?? [];
  if (picks.length === 0) return [];
  // Existing phonetic/synonyms/antonyms are already on the saved word.
  return buildSenseRows(picks, flatDefs, "", "", "");
}
