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

  let body: { word?: string; items?: GlossRequestItem[]; existingSenses?: ExistingSenseInput[]; backfillItems?: BackfillRequestItem[] };
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
