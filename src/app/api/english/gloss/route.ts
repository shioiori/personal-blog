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

  const phraseExclusion = `LOẠI BỎ những định nghĩa CHỈ áp dụng khi từ "${word}" kết hợp với một giới từ/trạng từ khác để tạo thành một CỤM ĐỘNG TỪ (phrasal verb) KHÁC có nghĩa riêng biệt (ví dụ: nếu từ đang xét là "bend", bỏ định nghĩa thực chất là của "bend down", "bend over", "bend to" — những cụm đó nên được thêm như một mục riêng, không gộp vào nghĩa của "${word}" đứng một mình). KHÔNG đánh giá độ phổ biến hay chọn lọc nghĩa thường dùng/hiếm — GIỮ LẠI TẤT CẢ các định nghĩa còn lại.`;

  const task = existingSenses.length > 0
    ? `Nhiệm vụ:
1. ${phraseExclusion}
2. Trong số còn lại, so sánh với các nghĩa ĐÃ CÓ ở trên. Nếu một định nghĩa chỉ diễn đạt lại (rephrase) cùng một ý với nghĩa đã có — dù câu chữ tiếng Anh khác nhau — thì KHÔNG chọn nó (đây là nghĩa trùng, không phải nghĩa mới). Giữ lại tất cả các định nghĩa còn lại (không đánh giá độ phổ biến).
3. Nếu không còn định nghĩa nào sau bước 1 và 2, trả về mảng "senses" rỗng.
4. Với mỗi nghĩa được giữ lại, viết nghĩa tiếng Việt NGẮN GỌN theo kiểu một cuốn từ điển Anh-Việt thật sự ghi (ví dụ: "mốc", "khuôn"), KHÔNG dịch nguyên câu định nghĩa tiếng Anh. Tối đa khoảng 5 từ.`
    : `Nhiệm vụ:
1. ${phraseExclusion}
2. Với mỗi nghĩa được giữ lại, viết nghĩa tiếng Việt NGẮN GỌN theo kiểu một cuốn từ điển Anh-Việt thật sự ghi (ví dụ: "mốc", "khuôn", "nấm mốc"), KHÔNG dịch nguyên câu định nghĩa tiếng Anh sang tiếng Việt. Mỗi nghĩa tiếng Việt chỉ nên là một từ hoặc cụm từ ngắn (tối đa khoảng 5 từ).`;

  return `Từ tiếng Anh: "${word}"
${existingSection}
Dưới đây là TOÀN BỘ các định nghĩa tiếng Anh thu thập được cho từ này (có thể trùng lặp hoặc gồm cả nghĩa rất hiếm/cổ), mỗi dòng có dạng "index | (loại từ) định nghĩa [ví dụ có sẵn hoặc không]":
${lines}

${task}

Ngoài ra, với MỖI nghĩa được chọn ở trên: nếu dòng đó có "[ví dụ có sẵn: ...]", GIỮ NGUYÊN câu ví dụ đó vào trường "example". Nếu dòng đó ghi "[KHÔNG CÓ ví dụ]", hãy TỰ VIẾT một câu ví dụ tiếng Anh NGẮN GỌN, tự nhiên, minh hoạ đúng nghĩa đó, điền vào "example".

Trả về CHỈ một JSON object dạng {"senses": [{"index": <số index gốc ở trên>, "meaningVi": "...", "example": "..."}, ...]}. Không thêm giải thích gì khác.`;
}

export async function POST(req: NextRequest) {
  if (!(await getUserId())) return unauthorized();

  let body: { word?: string; items?: GlossRequestItem[]; existingSenses?: ExistingSenseInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const word = body.word?.trim();
  const items = (body.items ?? []).filter((it) => it?.definition?.trim());
  const existingSenses = (body.existingSenses ?? []).filter((s) => s?.cambridgeMeaning?.trim() || s?.meaningVi?.trim());
  if (!word || items.length === 0) {
    return NextResponse.json({ senses: [] });
  }

  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ senses: [], error: "GROQ_API_KEY not configured" });
  }

  try {
    const { raw } = await aiComplete({
      groqModel: MODEL,
      // "low" reasoning_effort was reliably producing invented, non-words in
      // the Vietnamese gloss for this model (e.g. "điên rối", "cảm hận" —
      // reproduced 2/3 runs on "disruption" at low, 0/3 at high).
      maxTokens: 2048,
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
