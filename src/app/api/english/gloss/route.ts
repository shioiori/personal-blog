import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getUserId, unauthorized } from "@/src/lib/auth";

// Best-effort sense selection + Vietnamese gloss generation for word-add
// autofill. dictionaryapi.dev (the free source used by /api/english/crawl)
// often returns duplicate entries and orders definitions by etymology, not by
// how common they are — e.g. for "mould" the container/shaping sense comes
// first and the everyday fungus sense ends up far down the list. Rather than
// guessing which definitions to keep by position, this hands the FULL
// deduped list to the model and lets it pick the common, non-duplicate senses
// and gloss each one, the way a bilingual dictionary would (e.g. "mốc"), not
// a translated sentence of the English definition. Runs on Groq's free tier,
// triggered once per manual "add word" action, never bulk.
//
// When the word already exists, `existingSenses` is passed so the model can
// also do semantic dedup against what's already saved — e.g. "echo (n):
// tiếng vọng" already covers the idea, so a crawled definition that merely
// rephrases it should NOT be selected as a new sense, even if its English
// wording differs. Only genuinely missing senses (e.g. "echo (v): gợi nét,
// tương đồng với") should come back.

interface GlossRequestItem {
  partOfSpeech?: string | null;
  definition: string;
}

interface ExistingSenseInput {
  partOfSpeech?: string | null;
  cambridgeMeaning?: string | null;
  meaningVi?: string | null;
}

const MODEL = "openai/gpt-oss-20b";
const MAX_SENSES = 8;

function buildPrompt(word: string, items: GlossRequestItem[], existingSenses: ExistingSenseInput[]): string {
  const lines = items.map((it, i) => `${i} | (${it.partOfSpeech || "?"}) ${it.definition}`).join("\n");

  const existingSection =
    existingSenses.length > 0
      ? `\nTừ "${word}" ĐÃ CÓ sẵn các nghĩa sau trong từ điển cá nhân của người dùng (không được chọn lại, kể cả khi định nghĩa tiếng Anh bên dưới diễn đạt khác đi nhưng CÙNG Ý với một trong các nghĩa này):\n${existingSenses
          .map((s, i) => `  - (${s.partOfSpeech || "?"}) ${s.cambridgeMeaning || ""} => ${s.meaningVi || ""}`)
          .join("\n")}\n`
      : "";

  const task = existingSenses.length > 0
    ? `Nhiệm vụ:
1. So sánh từng định nghĩa bên dưới với các nghĩa ĐÃ CÓ ở trên. Nếu một định nghĩa chỉ diễn đạt lại (rephrase) cùng một ý với nghĩa đã có — dù câu chữ tiếng Anh khác nhau — thì KHÔNG chọn nó.
2. Chỉ chọn những định nghĩa thể hiện một Ý NGHĨA THỰC SỰ CÒN THIẾU, và trong số đó chỉ giữ lại nghĩa THƯỜNG DÙNG (common), bỏ nghĩa hiếm/cổ/chuyên ngành hẹp và nghĩa trùng lặp lẫn nhau. Tối đa ${MAX_SENSES} nghĩa mới, sắp theo mức độ phổ biến giảm dần.
3. Nếu không có nghĩa nào thực sự còn thiếu, trả về mảng "senses" rỗng.
4. Với mỗi nghĩa mới được chọn, viết nghĩa tiếng Việt NGẮN GỌN theo kiểu một cuốn từ điển Anh-Việt thật sự ghi (ví dụ: "mốc", "khuôn"), KHÔNG dịch nguyên câu định nghĩa tiếng Anh. Tối đa khoảng 5 từ.`
    : `Nhiệm vụ:
1. Chọn ra các nghĩa THƯỜNG DÙNG (common) của từ này, bỏ qua nghĩa trùng lặp (hai định nghĩa nói cùng một ý) và nghĩa hiếm/cổ/chuyên ngành hẹp. Tối đa ${MAX_SENSES} nghĩa, sắp theo mức độ phổ biến giảm dần.
2. Với mỗi nghĩa đã chọn, viết nghĩa tiếng Việt NGẮN GỌN theo kiểu một cuốn từ điển Anh-Việt thật sự ghi (ví dụ: "mốc", "khuôn", "nấm mốc"), KHÔNG dịch nguyên câu định nghĩa tiếng Anh sang tiếng Việt. Mỗi nghĩa tiếng Việt chỉ nên là một từ hoặc cụm từ ngắn (tối đa khoảng 5 từ).`;

  return `Từ tiếng Anh: "${word}"
${existingSection}
Dưới đây là TOÀN BỘ các định nghĩa tiếng Anh thu thập được cho từ này (có thể trùng lặp hoặc gồm cả nghĩa rất hiếm/cổ), mỗi dòng có dạng "index | (loại từ) định nghĩa":
${lines}

${task}

Trả về CHỈ một JSON object dạng {"senses": [{"index": <số index gốc ở trên>, "meaningVi": "..."}, ...]}. Không thêm giải thích gì khác.`;
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

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ senses: [], error: "GROQ_API_KEY not configured" });
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.3,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Bạn là một biên tập viên từ điển Anh-Việt, chuyên chọn lọc nghĩa thường dùng, phát hiện nghĩa trùng ý dù diễn đạt khác nhau, và viết nghĩa tiếng Việt ngắn gọn, tự nhiên. Luôn trả lời bằng JSON hợp lệ.",
        },
        { role: "user", content: buildPrompt(word, items, existingSenses) },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { senses?: unknown };
    const rawSenses = Array.isArray(parsed.senses) ? parsed.senses : [];

    const senses = rawSenses
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const index = Number((s as { index?: unknown }).index);
        const meaningVi = String((s as { meaningVi?: unknown }).meaningVi ?? "").trim();
        if (!Number.isInteger(index) || index < 0 || index >= items.length || !meaningVi) return null;
        return { index, meaningVi };
      })
      .filter((s): s is { index: number; meaningVi: string } => s !== null)
      .slice(0, MAX_SENSES);

    return NextResponse.json({ senses });
  } catch (e) {
    console.error("[POST english/gloss error]", e);
    return NextResponse.json({ senses: [], error: "gloss generation failed" });
  }
}
