import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { aiComplete } from "@/src/lib/ai-complete";

// Vietnamese gloss generation for word-add autofill. No longer judges
// "common" vs "rare" (that reasoning step, plus a cap on how many senses to
// keep, reliably blew through the token budget for a word with many
// definitions like "bend", 20 deduped — reproduced truncated/invalid JSON
// 1/5 runs). The model's only filtering job now is to drop definitions that
// only apply when the word combines with another particle into a DIFFERENT
// phrasal verb (e.g. a "bend" lookup shouldn't absorb "bend down"'s sense).
// Everything else is kept and glossed, the way a bilingual dictionary would
// (e.g. "mốc"), not a translated sentence of the English definition. Runs on
// Groq's free tier, triggered once per manual "add word" action, never bulk.
//
// When the word already exists, `existingSenses` is passed so the model can
// also do semantic dedup against what's already saved — e.g. "echo (n):
// tiếng vọng" already covers the idea, so a crawled definition that merely
// rephrases it should NOT come back as a new sense, even if its English
// wording differs.

interface GlossRequestItem {
  partOfSpeech?: string | null;
  definition: string;
  example?: string | null;
}

// Related-word expansion: given a word being added (e.g. "concentrated",
// adj), asks the model to suggest up to one word per other part of speech in
// the same word family (v/n/adj/phrase) and write a FULL dictionary entry for
// it AND for the word itself — all in one call, no dictionaryapi.dev crawl
// involved. Senses are grouped by "ý cảnh" (the underlying core sense a
// definition is an application of), e.g. "trunk" collapses tree-trunk/
// body-trunk/structure-trunk into one entry instead of three, but keeps
// "storage box" as a separate entry since that sense has drifted into a
// different concept. Phonetic here is model-generated (no dictionary source
// to check against), unlike the rest of this file's pipeline which never
// trusts the model for IPA — this is an explicit, known trade-off: fine for
// common words, unverifiable for rare ones.
interface RelatedExpandRequest {
  word: string;
  partOfSpeech?: string | null;
}

function buildRelatedExpandPrompt(word: string, partOfSpeech: string): string {
  const isPhraseInput = word.trim().includes(" ");
  const relatedStep = isPhraseInput
    ? `KHÔNG đề xuất bất kỳ từ liên đới nào — "${word}" đang xét ĐÃ LÀ một cụm từ/phrasal verb/idiom nhiều từ, nên bỏ qua hẳn bước này. Mục "related" trả về mảng rỗng.`
    : `Đề xuất các từ CÙNG GỐC (word family) liên quan trực tiếp, mỗi loại tối đa 1 từ: "v" (động từ), "n" (danh từ), "adj" (tính từ), "phrase" (cụm động từ/cụm cố định thông dụng chứa từ gốc, viết ở dạng nguyên mẫu, không chia thì). Bỏ qua loại nào không có hoặc không đủ thông dụng. KHÔNG đề xuất lại chính từ đang xét. Các từ liên đới đề xuất PHẢI KHÁC NHAU — không được đề xuất cùng một từ cho hai loại từ khác nhau.`;

  return `Từ tiếng Anh: "${word}" (loại từ: ${partOfSpeech || "?"}).

Nhiệm vụ — làm TOÀN BỘ các bước sau trong MỘT lần trả lời, không cần dữ liệu từ điển ngoài:

1. ${relatedStep}

2. Với từ chính VÀ mỗi từ liên đới vừa đề xuất, tự viết đầy đủ thông tin từ điển:
   - "phonetic": phiên âm IPA kiểu Anh-Anh chuẩn, KHÔNG kèm dấu gạch chéo "/" ở đầu/cuối (bỏ trống nếu là cụm từ không có phiên âm riêng).
   - "senses": danh sách các "ý cảnh" (nghĩa gốc) của từ đó. Hai định nghĩa thuộc CÙNG một ý cảnh khi một là ứng dụng trực tiếp của ý cảnh kia vào ngữ cảnh khác (vd thân cây/thân người/phần chính của vật đều là ứng dụng của ý cảnh "phần thân") — GỘP chúng vào MỘT sense. Chỉ tách sense mới khi nét nghĩa đã dịch chuyển sang phạm trù khái niệm khác hẳn (vd "phần thân" -> "vật chứa đồ"). Mỗi sense gồm:
     - "meaningVi": nghĩa tiếng Việt ngắn gọn kiểu từ điển Anh-Việt (tối đa ~6 từ). Nếu sense này gộp nhiều cách dùng, liệt kê gọn trong ngoặc, ví dụ "phần thân (thân cây, thân người)".
     - "definitionEn": 1 câu định nghĩa tiếng Anh ngắn gọn đại diện cho sense này.
     - "example": 1 câu ví dụ tiếng Anh tự nhiên minh hoạ đúng sense đó.
   - "synonyms": 2-4 từ đồng nghĩa tiếng Anh phổ biến (chuỗi, phân tách bởi dấu phẩy), để trống nếu không có từ nào thực sự phù hợp.
   - "antonyms": tương tự, trái nghĩa.

Chỉ đề xuất và viết nghĩa cho từ THỰC SỰ tồn tại và thông dụng — không bịa từ không có thật.

Trả về CHỈ JSON theo schema:
{"related":[{"word":"...","pos":"v|n|adj|phrase"}],
 "entries":[{"word":"...","pos":"...","phonetic":"...","senses":[{"meaningVi":"...","definitionEn":"...","example":"..."}],"synonyms":"...","antonyms":"..."}]}

"entries" phải bao gồm CẢ từ chính "${word}" và mọi từ liên đới ở mục "related". Không giải thích gì thêm ngoài JSON.`;
}

interface ExistingSenseInput {
  partOfSpeech?: string | null;
  cambridgeMeaning?: string | null;
  meaningVi?: string | null;
}

// A sense that's already saved but missing meaningVi and/or example — e.g.
// quick-added from the extension with only the English definition filled in.
// Backfilled directly from its own cambridgeMeaning, no dictionary crawl
// involved, since there's nothing to match against the way new-sense
// discovery matches crawled definitions.
interface BackfillRequestItem {
  index: number;
  partOfSpeech?: string | null;
  cambridgeMeaning: string;
  needsMeaningVi: boolean;
  needsExample: boolean;
}

function buildBackfillPrompt(word: string, items: BackfillRequestItem[]): string {
  const lines = items
    .map((it) => `${it.index} | (${it.partOfSpeech || "?"}) ${it.cambridgeMeaning} [cần: ${[it.needsMeaningVi && "nghĩa tiếng Việt", it.needsExample && "ví dụ"].filter(Boolean).join(", ")}]`)
    .join("\n");

  return `Từ tiếng Anh: "${word}"

Dưới đây là các nghĩa ĐÃ CÓ trong từ điển cá nhân của người dùng nhưng còn thiếu một vài trường, mỗi dòng có dạng "index | (loại từ) định nghĩa tiếng Anh [các trường cần điền]":
${lines}

Với MỖI dòng, chỉ điền đúng (các) trường được yêu cầu trong "[cần: ...]":
- "nghĩa tiếng Việt": viết NGẮN GỌN theo kiểu một cuốn từ điển Anh-Việt thật sự ghi (ví dụ: "mốc", "khuôn"), KHÔNG dịch nguyên câu định nghĩa tiếng Anh. Tối đa khoảng 5 từ.
- "ví dụ": tự viết một câu ví dụ tiếng Anh NGẮN GỌN, tự nhiên, minh hoạ đúng nghĩa đó.

Kiểm tra lại CHÍNH TẢ và DẤU THANH tiếng Việt thật cẩn thận trước khi trả lời — đặc biệt tránh nhầm giữa các từ chỉ khác nhau ở dấu thanh nhưng nghĩa hoàn toàn khác (ví dụ: "vòi" voi/"voi" con voi, "mốc"/"móc", "hòm"/"hòn"). Nếu không chắc chắn nghĩa tiếng Việt nào đúng, hãy chọn cách diễn đạt khác an toàn hơn thay vì đoán.

Trả về CHỈ một JSON object dạng {"backfill": [{"index": <số index gốc ở trên>, "meaningVi": "...", "example": "..."}, ...]}, chỉ gồm các trường thực sự được yêu cầu cho dòng đó. Không thêm giải thích gì khác.`;
}

// 20B still occasionally invents non-existent Vietnamese words even at
// reasoning_effort "high" (~1/5 runs reproduced for "disruption"); 120b was
// 0/6 across two different words in the same test. Cost difference is
// negligible at this usage volume.
const MODEL = "openai/gpt-oss-120b";

function buildPrompt(word: string, items: GlossRequestItem[], existingSenses: ExistingSenseInput[]): string {
  const lines = items
    .map((it, i) => {
      const exPart = it.example?.trim() ? ` [ví dụ có sẵn: ${it.example.trim()}]` : " [KHÔNG CÓ ví dụ]";
      return `${i} | (${it.partOfSpeech || "?"}) ${it.definition}${exPart}`;
    })
    .join("\n");

  const existingSection =
    existingSenses.length > 0
      ? `\nTừ "${word}" ĐÃ CÓ sẵn các nghĩa sau trong từ điển cá nhân của người dùng (không được chọn lại, kể cả khi định nghĩa tiếng Anh bên dưới diễn đạt khác đi nhưng CÙNG Ý với một trong các nghĩa này):\n${existingSenses
          .map((s, i) => `  - (${s.partOfSpeech || "?"}) ${s.cambridgeMeaning || ""} => ${s.meaningVi || ""}`)
          .join("\n")}\n`
      : "";

  const phraseExclusion = `LOẠI BỎ những định nghĩa CHỈ áp dụng khi từ "${word}" kết hợp với một giới từ/trạng từ khác để tạo thành một CỤM ĐỘNG TỪ (phrasal verb) KHÁC có nghĩa riêng biệt (ví dụ: nếu từ đang xét là "bend", bỏ định nghĩa thực chất là của "bend down", "bend over", "bend to" — những cụm đó nên được thêm như một mục riêng, không gộp vào nghĩa của "${word}" đứng một mình).`;

  const mergeSimilar = `GỘP các định nghĩa có nghĩa GẦN GIỐNG NHAU hoặc chỉ khác nhau về sắc thái nhỏ (cùng một ý cốt lõi dù áp dụng cho ngữ cảnh hơi khác nhau) thành MỘT nghĩa duy nhất — chỉ giữ lại định nghĩa đại diện rõ nhất cho mỗi ý, bỏ các định nghĩa trùng lặp còn lại. Chỉ tách thành nghĩa riêng khi chúng thực sự khác biệt về khái niệm. KHÔNG đánh giá độ phổ biến hay chọn lọc nghĩa thường dùng/hiếm trong số các nghĩa đã khác biệt — chỉ gộp nghĩa trùng ý, giữ lại mọi khái niệm khác biệt.`;

  const task = existingSenses.length > 0
    ? `Nhiệm vụ:
1. ${phraseExclusion}
2. ${mergeSimilar}
3. Trong số còn lại, so sánh với các nghĩa ĐÃ CÓ ở trên. Nếu một định nghĩa chỉ diễn đạt lại (rephrase) cùng một ý với nghĩa đã có — dù câu chữ tiếng Anh khác nhau — thì KHÔNG chọn nó (đây là nghĩa trùng, không phải nghĩa mới). Giữ lại tất cả các khái niệm khác biệt còn lại.
4. Nếu không còn định nghĩa nào sau các bước trên, trả về mảng "senses" rỗng.
5. Với mỗi nghĩa được giữ lại, viết nghĩa tiếng Việt NGẮN GỌN theo kiểu một cuốn từ điển Anh-Việt thật sự ghi (ví dụ: "mốc", "khuôn"), KHÔNG dịch nguyên câu định nghĩa tiếng Anh. Tối đa khoảng 5 từ.`
    : `Nhiệm vụ:
1. ${phraseExclusion}
2. ${mergeSimilar}
3. Với mỗi nghĩa được giữ lại, viết nghĩa tiếng Việt NGẮN GỌN theo kiểu một cuốn từ điển Anh-Việt thật sự ghi (ví dụ: "mốc", "khuôn", "nấm mốc"), KHÔNG dịch nguyên câu định nghĩa tiếng Anh sang tiếng Việt. Mỗi nghĩa tiếng Việt chỉ nên là một từ hoặc cụm từ ngắn (tối đa khoảng 5 từ).`;

  return `Từ tiếng Anh: "${word}"
${existingSection}
Dưới đây là TOÀN BỘ các định nghĩa tiếng Anh thu thập được cho từ này (có thể trùng lặp hoặc gồm cả nghĩa rất hiếm/cổ), mỗi dòng có dạng "index | (loại từ) định nghĩa [ví dụ có sẵn hoặc không]":
${lines}

${task}

Ngoài ra, với MỖI nghĩa được chọn ở trên: nếu dòng đó có "[ví dụ có sẵn: ...]", GIỮ NGUYÊN câu ví dụ đó vào trường "example". Nếu dòng đó ghi "[KHÔNG CÓ ví dụ]", hãy TỰ VIẾT một câu ví dụ tiếng Anh NGẮN GỌN, tự nhiên, minh hoạ đúng nghĩa đó, điền vào "example".

Trả về CHỈ một JSON object dạng {"senses": [{"index": <số index gốc ở trên, ĐẠI DIỆN cho nhóm nếu đã gộp nhiều định nghĩa>, "meaningVi": "...", "example": "..."}, ...]}. Không thêm giải thích gì khác.`;
}

export async function POST(req: NextRequest) {
  if (!(await getUserId())) return unauthorized();

  let body: {
    word?: string;
    items?: GlossRequestItem[];
    existingSenses?: ExistingSenseInput[];
    backfillItems?: BackfillRequestItem[];
    expandRelated?: RelatedExpandRequest;
    fullyAiAdd?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const word = body.word?.trim();
  if (!word) return NextResponse.json({ senses: [] });

  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ senses: [], error: "GROQ_API_KEY not configured" });
  }

  if (body.fullyAiAdd) return handleFullyAiAdd(word);
  if (body.expandRelated) return handleExpandRelated(word, body.expandRelated.partOfSpeech ?? "");

  const backfillItems = (body.backfillItems ?? []).filter(
    (it) => it?.cambridgeMeaning?.trim() && Number.isInteger(it.index) && (it.needsMeaningVi || it.needsExample)
  );
  if (backfillItems.length > 0) return handleBackfill(word, backfillItems);

  const items = (body.items ?? []).filter((it) => it?.definition?.trim());
  const existingSenses = (body.existingSenses ?? []).filter((s) => s?.cambridgeMeaning?.trim() || s?.meaningVi?.trim());
  if (items.length === 0) {
    return NextResponse.json({ senses: [] });
  }

  try {
    const { raw } = await aiComplete({
      groqModel: MODEL,
      // "low" reasoning_effort was reliably producing invented, non-words in
      // the Vietnamese gloss for this model (e.g. "điên rối", "cảm hận" —
      // reproduced 2/3 runs on "disruption" at low, 0/3 at high). At "high"
      // effort, a word with many unrelated senses (e.g. "trunk", 9 deduped
      // definitions) can burn the token budget on reasoning before any JSON
      // is emitted, causing Groq to reject the request outright with a 400
      // json_validate_failed and an empty failed_generation. Reproduced live
      // for "trunk": still ~2/3 failure rate at 2048-4096 tokens (reasoning
      // length is non-deterministic), dropping to ~1/4 at 6144 — raised
      // further to 8192 for extra margin — and the caller
      // (buildSensesFromDictionary) also retries once on this specific
      // failure, so the two together make an eventual success near-certain.
      maxTokens: 8192,
      temperature: 0.3,
      reasoningEffort: "high",
      systemPrompt:
        "Bạn là một biên tập viên từ điển Anh-Việt, chuyên chọn lọc nghĩa thường dùng, phát hiện nghĩa trùng ý dù diễn đạt khác nhau, và viết nghĩa tiếng Việt ngắn gọn, tự nhiên. Luôn trả lời bằng JSON hợp lệ.",
      userPrompt: buildPrompt(word, items, existingSenses),
    });
    const parsed = JSON.parse(raw) as { senses?: unknown };
    const rawSenses = Array.isArray(parsed.senses) ? parsed.senses : [];

    const senses = rawSenses
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const index = Number((s as { index?: unknown }).index);
        const meaningVi = String((s as { meaningVi?: unknown }).meaningVi ?? "").trim();
        if (!Number.isInteger(index) || index < 0 || index >= items.length || !meaningVi) return null;
        const modelExample = String((s as { example?: unknown }).example ?? "").trim();
        // Prefer the example actually present in the source data over the
        // model's own — only use the model's (possibly generated) one when
        // the source had none.
        const example = items[index].example?.trim() || modelExample;
        return { index, meaningVi, example };
      })
      .filter((s): s is { index: number; meaningVi: string; example: string } => s !== null);

    return NextResponse.json({ senses });
  } catch (e) {
    console.error("[POST english/gloss error]", e);
    return NextResponse.json({ senses: [], error: "gloss generation failed" });
  }
}

interface ExpandEntryRaw {
  word?: unknown;
  pos?: unknown;
  phonetic?: unknown;
  senses?: unknown;
  synonyms?: unknown;
  antonyms?: unknown;
}

function normalizeWordKey(w: string): string {
  return w.trim().toLowerCase().replace(/\s+/g, " ");
}

// Shared by handleExpandRelated and handleFullyAiAdd — both ask the model
// for the same {word, pos, phonetic, senses, synonyms, antonyms}[] shape,
// just via different prompts (one takes a word already known to be valid,
// the other validates+lemmatizes first).
//
// `mainWord` (the word/lemma the whole request is about) drives two
// defensive, code-level cleanups on top of the prompt's own instructions —
// the model doesn't reliably follow either on its own:
// - Dedup by word text: reproduced live for "let matters slide" (already a
//   multi-word phrase), which came back with two separate "slide" entries.
// - Drop every OTHER entry when mainWord is itself multi-word (a phrase/
//   phrasal verb/idiom) — per explicit decision, a phrase gets no related
//   words at all (not even v/n/adj), since its base verb is expected to be
//   added as its own separate entry rather than inferred here.
function parseExpandEntries(parsed: { entries?: unknown }, mainWord: string) {
  const rawEntries = Array.isArray(parsed.entries) ? (parsed.entries as ExpandEntryRaw[]) : [];
  const mainKey = normalizeWordKey(mainWord);
  const mainIsPhrase = mainWord.trim().includes(" ");
  const seen = new Set<string>();

  return rawEntries
    .map((e) => {
      const entryWord = String(e.word ?? "").trim();
      if (!entryWord) return null;
      const pos = String(e.pos ?? "").trim();
      const key = normalizeWordKey(entryWord);
      if (seen.has(key)) return null; // duplicate word text — keep only the first
      if (mainIsPhrase && key !== mainKey) return null; // phrase input: no related words at all, any pos

      const rawSenses = Array.isArray(e.senses) ? e.senses : [];
      const senses = rawSenses
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const meaningVi = String((s as { meaningVi?: unknown }).meaningVi ?? "").trim();
          if (!meaningVi) return null;
          return {
            meaningVi,
            definitionEn: String((s as { definitionEn?: unknown }).definitionEn ?? "").trim(),
            example: String((s as { example?: unknown }).example ?? "").trim(),
          };
        })
        .filter((s): s is { meaningVi: string; definitionEn: string; example: string } => s !== null);
      if (senses.length === 0) return null;

      seen.add(key);
      return {
        word: entryWord,
        pos,
        phonetic: String(e.phonetic ?? "").trim().replace(/^\/+|\/+$/g, ""),
        senses,
        synonyms: String(e.synonyms ?? "").trim(),
        antonyms: String(e.antonyms ?? "").trim(),
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
}

// Double the main gloss endpoint's budget — this single call has to write
// full dictionary entries (not just a short gloss) for the main word AND up
// to 4 related words at once, which empirically runs ~1,000-1,050 completion
// tokens per entry at reasoning_effort "high" (measured live: ~5,800 tokens
// total for 5 entries, ~3,750 for 3).
const EXPAND_MAX_TOKENS = 8192 * 2;

const EXPAND_SYSTEM_PROMPT =
  "Bạn là biên tập viên từ điển Anh-Việt chuyên sâu, giỏi nhận diện word family, ý cảnh (nghĩa gốc chung đằng sau các cách dùng khác nhau), và viết nghĩa tiếng Việt ngắn gọn tự nhiên, phiên âm chuẩn. Luôn trả lời bằng JSON hợp lệ, không bịa từ không tồn tại.";

async function handleExpandRelated(word: string, partOfSpeech: string) {
  try {
    const { raw } = await aiComplete({
      groqModel: MODEL,
      maxTokens: EXPAND_MAX_TOKENS,
      temperature: 0.3,
      reasoningEffort: "high",
      systemPrompt: EXPAND_SYSTEM_PROMPT,
      userPrompt: buildRelatedExpandPrompt(word, partOfSpeech),
    });
    const parsed = JSON.parse(raw) as { related?: unknown; entries?: unknown };
    return NextResponse.json({ entries: parseExpandEntries(parsed, word) });
  } catch (e) {
    console.error("[POST english/gloss expandRelated error]", e);
    return NextResponse.json({ entries: [], error: "related-word expansion failed" });
  }
}

// Fully AI-driven add: no dictionaryapi.dev crawl, no local lemmatizer —
// asks the model to validate the raw selected text is a real English
// word/phrase, normalize it to its dictionary base form (lemma), then write
// full entries for the lemma and its word family, all in one call. Per
// explicit instruction: any failure of the validation step must make the
// model bail out (`valid: false`) rather than press on and invent content
// for something that isn't a real word.
function buildFullyAiAddPrompt(rawWord: string): string {
  return `Văn bản người dùng chọn để thêm vào từ điển cá nhân: "${rawWord}"

Nhiệm vụ — làm TOÀN BỘ các bước sau trong MỘT lần trả lời:

1. KIỂM TRA: đây có phải một từ/cụm từ tiếng Anh CÓ THẬT và có nghĩa rõ ràng không? Từ chối (dừng ngay, không làm bước nào sau) nếu đây là: một câu hoàn chỉnh (có chủ ngữ+động từ diễn đạt một ý trọn vẹn), văn bản vô nghĩa/gõ nhầm, ngôn ngữ khác không phải tiếng Anh, hoặc không phải từ/cụm từ thực sự tồn tại trong tiếng Anh. Nếu bị từ chối, trả về NGAY {"valid": false, "reason": "<lý do ngắn gọn bằng tiếng Việt>"} và DỪNG — không thực hiện các bước 2-4.

2. Nếu hợp lệ: chuẩn hoá về DẠNG GỐC trong từ điển (lemma) — ví dụ số nhiều -> số ít, động từ chia thì -> nguyên mẫu, so sánh hơn/nhất -> dạng gốc, cụm động từ chia thì -> dạng nguyên mẫu của cụm. Giữ nguyên nếu đã là dạng gốc.

3. ${rawWord.trim().includes(" ")
    ? `KHÔNG đề xuất bất kỳ từ liên đới nào — "${rawWord}" là một cụm từ/phrasal verb/idiom nhiều từ, nên bỏ qua hẳn bước này dù lemma có thể viết hơi khác. Mục "entries" chỉ gồm 1 phần tử là chính lemma.`
    : `Đề xuất các từ CÙNG GỐC (word family) liên quan trực tiếp đến lemma, mỗi loại tối đa 1 từ: "v" (động từ), "n" (danh từ), "adj" (tính từ), "phrase" (cụm động từ/cụm cố định thông dụng chứa lemma, dạng nguyên mẫu). Bỏ qua loại nào không có hoặc không đủ thông dụng. KHÔNG đề xuất lại chính lemma. Các từ liên đới đề xuất PHẢI KHÁC NHAU — không được đề xuất cùng một từ cho hai loại từ khác nhau.`}

4. Với lemma VÀ mỗi từ liên đới vừa đề xuất, tự viết đầy đủ thông tin từ điển:
   - "phonetic": phiên âm IPA kiểu Anh-Anh chuẩn, KHÔNG kèm dấu gạch chéo "/" ở đầu/cuối (bỏ trống nếu là cụm từ không có phiên âm riêng).
   - "senses": danh sách các "ý cảnh" (nghĩa gốc) của từ đó. Hai định nghĩa thuộc CÙNG một ý cảnh khi một là ứng dụng trực tiếp của ý cảnh kia vào ngữ cảnh khác (vd thân cây/thân người/phần chính của vật đều là ứng dụng của ý cảnh "phần thân") — GỘP chúng vào MỘT sense. Chỉ tách sense mới khi nét nghĩa đã dịch chuyển sang phạm trù khái niệm khác hẳn (vd "phần thân" -> "vật chứa đồ"). Mỗi sense gồm "meaningVi" (ngắn gọn kiểu từ điển Anh-Việt, tối đa ~6 từ, liệt kê gọn trong ngoặc nếu gộp nhiều cách dùng), "definitionEn" (1 câu tiếng Anh ngắn gọn), "example" (1 câu ví dụ tiếng Anh tự nhiên).
   - "synonyms": 2-4 từ đồng nghĩa tiếng Anh phổ biến (chuỗi, phân tách bởi dấu phẩy), để trống nếu không có từ nào thực sự phù hợp.
   - "antonyms": tương tự, trái nghĩa.

Chỉ đề xuất và viết nghĩa cho từ THỰC SỰ tồn tại và thông dụng — không bịa từ không có thật.

Trả về CHỈ JSON theo một trong hai dạng:
- Không hợp lệ: {"valid": false, "reason": "..."}
- Hợp lệ: {"valid": true, "lemma": "...", "entries": [{"word":"...","pos":"...","phonetic":"...","senses":[{"meaningVi":"...","definitionEn":"...","example":"..."}],"synonyms":"...","antonyms":"..."}]}

"entries" phải bao gồm CẢ lemma và mọi từ liên đới. Không giải thích gì thêm ngoài JSON.`;
}

async function handleFullyAiAdd(rawWord: string) {
  try {
    const { raw } = await aiComplete({
      groqModel: MODEL,
      maxTokens: EXPAND_MAX_TOKENS,
      temperature: 0.3,
      reasoningEffort: "high",
      systemPrompt: EXPAND_SYSTEM_PROMPT,
      userPrompt: buildFullyAiAddPrompt(rawWord),
    });
    const parsed = JSON.parse(raw) as { valid?: unknown; reason?: unknown; lemma?: unknown; entries?: unknown };
    if (parsed.valid !== true) {
      return NextResponse.json({ valid: false, reason: String(parsed.reason ?? "Không nhận diện được đây là từ tiếng Anh hợp lệ.") });
    }
    const lemma = String(parsed.lemma ?? "").trim();
    if (!lemma) return NextResponse.json({ valid: false, reason: "AI không xác định được dạng gốc của từ." });
    return NextResponse.json({ valid: true, lemma, entries: parseExpandEntries(parsed, lemma) });
  } catch (e) {
    console.error("[POST english/gloss fullyAiAdd error]", e);
    return NextResponse.json({ valid: false, reason: "AI gặp lỗi, thử lại sau hoặc thêm thủ công." });
  }
}

async function handleBackfill(word: string, items: BackfillRequestItem[]) {
  try {
    const { raw } = await aiComplete({
      groqModel: MODEL,
      // "low" reasoning_effort produced a confirmed diacritic mix-up live
      // (elephant-trunk sense of "trunk" glossed as "voi", meaning elephant,
      // instead of "vòi", the organ) — same failure mode the main gloss
      // prompt above already hit at "low" and fixed by raising to "high".
      maxTokens: 4096,
      temperature: 0.3,
      reasoningEffort: "high",
      systemPrompt:
        "Bạn là một biên tập viên từ điển Anh-Việt, chuyên viết nghĩa tiếng Việt ngắn gọn, tự nhiên và ví dụ minh hoạ. Luôn trả lời bằng JSON hợp lệ.",
      userPrompt: buildBackfillPrompt(word, items),
    });
    const parsed = JSON.parse(raw) as { backfill?: unknown };
    const rawBackfill = Array.isArray(parsed.backfill) ? parsed.backfill : [];
    const byIndex = new Map(items.map((it) => [it.index, it]));

    const backfill = rawBackfill
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const index = Number((s as { index?: unknown }).index);
        const req = byIndex.get(index);
        if (!req) return null;
        const meaningVi = req.needsMeaningVi ? String((s as { meaningVi?: unknown }).meaningVi ?? "").trim() : undefined;
        const example = req.needsExample ? String((s as { example?: unknown }).example ?? "").trim() : undefined;
        if (!meaningVi && !example) return null;
        return { index, ...(meaningVi ? { meaningVi } : {}), ...(example ? { example } : {}) };
      })
      .filter((s): s is { index: number; meaningVi?: string; example?: string } => s !== null);

    return NextResponse.json({ backfill });
  } catch (e) {
    console.error("[POST english/gloss backfill error]", e);
    return NextResponse.json({ backfill: [], error: "backfill generation failed" });
  }
}
