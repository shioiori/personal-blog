import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isPremium, unauthorized } from "@/src/lib/auth";
import { geminiComplete } from "@/src/lib/ai-complete";
import { createExercise, ensureGapFillTables, listExercises } from "@/src/lib/english-gapfill-db";
import { fitsWordLimit, isWordLimit, WORD_LIMITS, type WordLimit } from "@/src/lib/gapfill-word-limit";
import type { GapFillAnswer } from "@/src/declaration/english";

const MODEL = "gemini-3.5-flash";
const MAX_INPUT_LENGTH = 30000;
const MIN_BLANKS = 7;
const MAX_BLANKS = 10;
const MAX_TRIES = 2;

const SYSTEM_PROMPT =
  "Bạn là giáo viên ra đề IELTS Listening cẩn thận: chỉ ra đề bám sát đúng nội dung transcript, không bịa thông tin. Luôn trả lời bằng JSON hợp lệ.";

const PROMPT = (input: string, wordLimit: WordLimit) => `Dưới đây là nội dung người dùng dán vào (nằm giữa hai dòng ===). Nó gồm transcript của một bài nghe tiếng Anh, có thể kèm theo một bài điền từ (gap-fill) gốc.

===
${input}
===

BƯỚC 1 — KIỂM TRA: Nếu nội dung KHÔNG phải tiếng Anh, hoặc là chuỗi ký tự linh tinh/vô nghĩa, không phải transcript của một bài nghe, trả về NGAY {"status": "invalid"} và DỪNG LẠI.

BƯỚC 2 — XÁC ĐỊNH BÀI GỐC:
- Nếu nội dung đã có sẵn bài điền từ (có các chỗ trống như ___, ......, (1), [1]...), dùng bài đó làm bài gốc.
- Nếu không có, dùng Google Search tìm bài điền từ gốc đi kèm transcript này (ví dụ đề Cambridge IELTS Listening). Chỉ dùng làm bài gốc khi chắc chắn đúng là bài của transcript này; nếu không tìm thấy thì coi như không có bài gốc.

BƯỚC 3 — TẠO BÀI MỚI dựa trên transcript, trình bày giống đề IELTS Listening Part 4 (note completion cho một bài giảng học thuật):
- Dòng đầu là tiêu đề bài giảng, sau đó chia thành các mục có tiêu đề ngắn, theo đúng trình tự nội dung bài nói.
- Mỗi ý là một gạch đầu dòng "• " ngắn gọn kiểu ghi chú (không viết thành đoạn văn), mỗi gạch đầu dòng có TỐI ĐA MỘT chỗ trống.
- Nếu có bài gốc: tạo một bản KHÁC bài gốc — ưu tiên diễn đạt lại bằng câu chữ khác và chọn chỗ trống khác bài gốc, nội dung vẫn bám đúng transcript.
- Nếu không có bài gốc: tự tạo từ transcript.
- Có từ ${MIN_BLANKS} đến ${MAX_BLANKS} chỗ trống, đánh dấu bằng {{1}}, {{2}}, ... theo đúng thứ tự xuất hiện, mỗi số dùng đúng một lần.
- Mỗi đáp án phải tuân thủ đúng giới hạn "${WORD_LIMITS[wordLimit].instruction}" và phải là từ/cụm từ được nói NGUYÊN VĂN trong transcript, đúng từng chữ — chỉ phần câu chữ xung quanh chỗ trống được diễn đạt lại, TUYỆT ĐỐI KHÔNG thay đáp án bằng từ đồng nghĩa hay cách nói khác. Ví dụ: transcript nói "...directing them towards a designated open plane." thì đáp án phải là "open plane", KHÔNG được là "open area".
- Mỗi đáp án kèm "alternatives": CHỈ gồm các khác biệt về cách viết (vd "15" và "fifteen", chính tả Anh-Anh/Anh-Mỹ), KHÔNG được là từ đồng nghĩa; để [] nếu không có.
- "content": phần notes hoàn chỉnh bằng tiếng Anh, xuống dòng bằng "\\n", TUYỆT ĐỐI KHÔNG chứa đáp án.
- "title": tiêu đề ngắn gọn bằng tiếng Anh cho bài.

Trả về CHỈ một JSON object: {"status": "ok", "title": "...", "content": "...", "answers": [{"answer": "...", "alternatives": ["..."]}]} trong đó answers[i] là đáp án của {{i+1}}.`;

type ParsedExercise = { title: string; content: string; answers: GapFillAnswer[] };

function toMatchText(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, " ").trim()} `;
}

function appearsInTranscript(answer: GapFillAnswer, transcriptText: string): boolean {
  const candidates = /\d/.test(answer.answer) ? [answer.answer, ...answer.alternatives] : [answer.answer];
  return candidates.some((candidate) => {
    const text = toMatchText(candidate);
    return text.trim() !== "" && transcriptText.includes(text);
  });
}

function parseExercise(raw: string, wordLimit: WordLimit, transcriptText: string): ParsedExercise | "invalid" | null {
  let parsed: { status?: unknown; title?: unknown; content?: unknown; answers?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed.status === "invalid") return "invalid";

  const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
  if (!content || !Array.isArray(parsed.answers)) return null;

  const answers = parsed.answers.map((a) => {
    const item = (a ?? {}) as { answer?: unknown; alternatives?: unknown };
    return {
      answer: String(item.answer ?? "").trim(),
      alternatives: Array.isArray(item.alternatives)
        ? item.alternatives.map((alt) => String(alt ?? "").trim()).filter(Boolean)
        : [],
    };
  });
  if (answers.length < MIN_BLANKS || answers.length > MAX_BLANKS) return null;
  if (answers.some((a) => !a.answer || !fitsWordLimit(a.answer, wordLimit) || !appearsInTranscript(a, transcriptText))) return null;

  const placeholders = [...content.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  if (placeholders.length !== answers.length || placeholders.some((n, i) => n !== i + 1)) return null;

  const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : "Gap-fill exercise";
  return { title, content, answers };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    await ensureGapFillTables();
    return NextResponse.json({ exercises: await listExercises(user.id) });
  } catch (e) {
    console.error("[GET english/gapfill error]", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!isPremium(user)) return NextResponse.json({ needsPremium: true }, { status: 403 });

  let body: { input?: string; wordLimit?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const input = body.input?.trim() ?? "";
  const wordLimit = body.wordLimit;
  if (!input) return NextResponse.json({ error: "input is required" }, { status: 400 });
  if (!isWordLimit(wordLimit)) return NextResponse.json({ error: "invalid wordLimit" }, { status: 400 });
  if (input.length > MAX_INPUT_LENGTH) return NextResponse.json({ tooLong: true }, { status: 400 });

  try {
    await ensureGapFillTables();
    const transcriptText = toMatchText(input);
    for (let i = 0; i < MAX_TRIES; i++) {
      const raw = await geminiComplete({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: PROMPT(input, wordLimit),
        maxTokens: 8192,
        temperature: 0.7,
        googleSearch: true,
        model: MODEL,
      });
      const result = parseExercise(raw, wordLimit, transcriptText);
      if (result === "invalid") return NextResponse.json({ invalid: true }, { status: 422 });
      if (result) {
        const id = await createExercise(user.id, { ...result, transcript: input, wordLimit });
        return NextResponse.json({ id });
      }
      console.warn("[POST english/gapfill] invalid AI output, retrying:", raw.slice(0, 500));
    }
    return NextResponse.json({ error: "generation failed" }, { status: 502 });
  } catch (e) {
    console.error("[POST english/gapfill error]", e);
    return NextResponse.json({ error: "generation failed" }, { status: 500 });
  }
}
