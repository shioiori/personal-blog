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

interface GlossRequestItem {
  partOfSpeech?: string | null;
  definition: string;
}

const MODEL = "openai/gpt-oss-20b";
const MAX_SENSES = 8;

function buildPrompt(word: string, items: GlossRequestItem[]): string {
  const lines = items.map((it, i) => `${i} | (${it.partOfSpeech || "?"}) ${it.definition}`).join("\n");
  return `Từ tiếng Anh: "${word}"

Dưới đây là TOÀN BỘ các định nghĩa tiếng Anh thu thập được cho từ này (có thể trùng lặp hoặc gồm cả nghĩa rất hiếm/cổ), mỗi dòng có dạng "index | (loại từ) định nghĩa":
${lines}

Nhiệm vụ:
1. Chọn ra các nghĩa THƯỜNG DÙNG (common) của từ này, bỏ qua nghĩa trùng lặp (hai định nghĩa nói cùng một ý) và nghĩa hiếm/cổ/chuyên ngành hẹp. Tối đa ${MAX_SENSES} nghĩa, sắp theo mức độ phổ biến giảm dần.
2. Với mỗi nghĩa đã chọn, viết nghĩa tiếng Việt NGẮN GỌN theo kiểu một cuốn từ điển Anh-Việt thật sự ghi (ví dụ: "mốc", "khuôn", "nấm mốc"), KHÔNG dịch nguyên câu định nghĩa tiếng Anh sang tiếng Việt. Mỗi nghĩa tiếng Việt chỉ nên là một từ hoặc cụm từ ngắn (tối đa khoảng 5 từ).

Trả về CHỈ một JSON object dạng {"senses": [{"index": <số index gốc ở trên>, "meaningVi": "..."}, ...]}. Không thêm giải thích gì khác.`;
}

export async function POST(req: NextRequest) {
  if (!(await getUserId())) return unauthorized();

  let body: { word?: string; items?: GlossRequestItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const word = body.word?.trim();
  const items = (body.items ?? []).filter((it) => it?.definition?.trim());
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
            "Bạn là một biên tập viên từ điển Anh-Việt, chuyên chọn lọc nghĩa thường dùng và viết nghĩa tiếng Việt ngắn gọn, tự nhiên. Luôn trả lời bằng JSON hợp lệ.",
        },
        { role: "user", content: buildPrompt(word, items) },
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
