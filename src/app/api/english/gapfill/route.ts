import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isPremium, unauthorized } from "@/src/lib/auth";
import { geminiComplete } from "@/src/lib/ai-complete";
import {
  createExercise,
  createScript,
  ensureGapFillTables,
  findScriptByTranscript,
  getScriptTranscript,
  listScriptExerciseContents,
  listScripts,
  normalizeScriptName,
  normalizeSource,
  updateScriptSource,
} from "@/src/lib/english-gapfill-db";
import { fitsWordLimit, isWordLimit, WORD_LIMITS, type WordLimit } from "@/src/lib/gapfill-word-limit";
import type { GapFillAnswer } from "@/src/declaration/english";

const MODEL = "gemini-3.5-flash";
const MAX_INPUT_LENGTH = 30000;
const MIN_BLANKS = 7;
const MAX_BLANKS = 10;
const MAX_TRIES = 2;
const SIMILARITY_LIMIT = 0.8;
const MAX_PREVIOUS_IN_PROMPT = 5;

type PreviousExercise = { content: string; answers: GapFillAnswer[] };

const SYSTEM_PROMPT =
  "Bạn là giáo viên ra đề IELTS Listening cẩn thận: chỉ ra đề bám sát đúng nội dung transcript, không bịa thông tin. Luôn trả lời bằng JSON hợp lệ.";

const PREVIOUS_SECTION = (previous: PreviousExercise[]) =>
  previous.length === 0
    ? ""
    : `CÁC BÀI ĐÃ TẠO TỪ TRANSCRIPT NÀY — bài mới phải KHÁC HẲN: chọn chỗ trống và đáp án khác, diễn đạt câu chữ khác; KHÔNG được trùng từ 80% nội dung hoặc 80% đáp án trở lên với bất kỳ bài nào dưới đây:

${previous.map((p, i) => `--- Bài ${i + 1} ---\n${p.content}\nĐáp án: ${p.answers.map((a) => a.answer).join("; ")}`).join("\n\n")}

`;

const PROMPT = (input: string, wordLimit: WordLimit, previous: PreviousExercise[]) => `Dưới đây là nội dung người dùng dán vào (nằm giữa hai dòng ===). Nó gồm transcript của một bài nghe tiếng Anh, có thể kèm theo một bài điền từ (gap-fill) gốc.

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
- Đáp án KHÔNG được là tên riêng (tên người, địa danh, tổ chức, công ty, thương hiệu, tác phẩm...), NGOẠI TRỪ tên quốc gia và tên ngôn ngữ (vd "Japan", "Spanish" thì được).
- HẠN CHẾ chọn đáp án là thuật ngữ chuyên ngành hoặc từ hiếm/cổ mà người học khó biết — ví dụ câu "Trousers of that period were called breeches" thì KHÔNG nên chọn "breeches" làm chỗ trống; ưu tiên các từ/cụm từ thông dụng.
- Mỗi đáp án kèm "alternatives": CHỈ gồm các khác biệt về cách viết (vd "15" và "fifteen", chính tả Anh-Anh/Anh-Mỹ), KHÔNG được là từ đồng nghĩa; để [] nếu không có.
- "content": phần notes hoàn chỉnh bằng tiếng Anh, xuống dòng bằng "\\n", TUYỆT ĐỐI KHÔNG chứa đáp án.
- "title": tiêu đề ngắn gọn bằng tiếng Anh cho bài.
- "scriptTitle": tên ngắn gọn bằng tiếng Anh cho chủ đề của transcript (vd tên bài giảng), dùng để đặt tên cho script.

${PREVIOUS_SECTION(previous)}Trả về CHỈ một JSON object: {"status": "ok", "title": "...", "scriptTitle": "...", "content": "...", "answers": [{"answer": "...", "alternatives": ["..."]}]} trong đó answers[i] là đáp án của {{i+1}}.`;

type ParsedExercise = { title: string; scriptTitle: string; content: string; answers: GapFillAnswer[] };

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

function contentTrigrams(content: string): Set<string> {
  const words = toMatchText(content.replace(/\{\{\d+\}\}/g, " ")).trim().split(" ").filter(Boolean);
  const grams = new Set<string>();
  for (let i = 0; i + 2 < words.length; i++) grams.add(words.slice(i, i + 3).join(" "));
  return grams;
}

function contentSimilarity(a: string, b: string): number {
  const gramsA = contentTrigrams(a);
  const gramsB = contentTrigrams(b);
  if (gramsA.size === 0 || gramsB.size === 0) return 0;
  const shared = [...gramsA].filter((g) => gramsB.has(g)).length;
  return (2 * shared) / (gramsA.size + gramsB.size);
}

function answerOverlap(a: GapFillAnswer[], b: GapFillAnswer[]): number {
  const setA = new Set(a.map((x) => toMatchText(x.answer)));
  const setB = new Set(b.map((x) => toMatchText(x.answer)));
  const shared = [...setA].filter((x) => setB.has(x)).length;
  return shared / Math.min(setA.size, setB.size);
}

function isTooSimilar(candidate: PreviousExercise, previous: PreviousExercise[]): boolean {
  return previous.some(
    (p) =>
      contentSimilarity(candidate.content, p.content) >= SIMILARITY_LIMIT ||
      answerOverlap(candidate.answers, p.answers) >= SIMILARITY_LIMIT
  );
}

function parseExercise(raw: string, wordLimit: WordLimit, transcriptText: string): ParsedExercise | "invalid" | null {
  let parsed: { status?: unknown; title?: unknown; scriptTitle?: unknown; content?: unknown; answers?: unknown };
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
  const scriptTitle = typeof parsed.scriptTitle === "string" && parsed.scriptTitle.trim() ? parsed.scriptTitle.trim() : title;
  return { title, scriptTitle, content, answers };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    await ensureGapFillTables();
    return NextResponse.json({ scripts: await listScripts(user.id) });
  } catch (e) {
    console.error("[GET english/gapfill error]", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!isPremium(user)) return NextResponse.json({ needsPremium: true }, { status: 403 });

  let body: { input?: string; scriptId?: unknown; wordLimit?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const wordLimit = body.wordLimit;
  const requestedScriptId = typeof body.scriptId === "number" ? body.scriptId : null;
  const input = body.input?.trim() ?? "";
  if (!isWordLimit(wordLimit)) return NextResponse.json({ error: "invalid wordLimit" }, { status: 400 });
  if (requestedScriptId === null && !input) return NextResponse.json({ error: "input is required" }, { status: 400 });
  if (input.length > MAX_INPUT_LENGTH) return NextResponse.json({ tooLong: true }, { status: 400 });

  try {
    await ensureGapFillTables();
    let scriptId = requestedScriptId;
    let transcript = input;
    if (requestedScriptId !== null) {
      const stored = await getScriptTranscript(user.id, requestedScriptId);
      if (stored === null) return NextResponse.json({ error: "not found" }, { status: 404 });
      transcript = stored;
    } else {
      scriptId = await findScriptByTranscript(user.id, input);
    }

    const previous = scriptId !== null ? await listScriptExerciseContents(scriptId) : [];
    const transcriptText = toMatchText(transcript);
    let tooSimilar = false;
    for (let i = 0; i < MAX_TRIES; i++) {
      const raw = await geminiComplete({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: PROMPT(transcript, wordLimit, previous.slice(0, MAX_PREVIOUS_IN_PROMPT)),
        maxTokens: 8192,
        temperature: 0.7,
        googleSearch: true,
        model: MODEL,
      });
      const result = parseExercise(raw, wordLimit, transcriptText);
      if (result === "invalid") return NextResponse.json({ invalid: true }, { status: 422 });
      tooSimilar = result !== null && isTooSimilar(result, previous);
      if (result && !tooSimilar) {
        const source = normalizeSource(body.source);
        if (scriptId === null) scriptId = await createScript(user.id, transcript, source, normalizeScriptName(result.scriptTitle) ?? "Script");
        else if (requestedScriptId === null && source) await updateScriptSource(user.id, scriptId, source);
        const id = await createExercise(user.id, scriptId, { ...result, wordLimit });
        return NextResponse.json({ id, scriptId });
      }
      console.warn(`[POST english/gapfill] ${tooSimilar ? "too similar" : "invalid AI output"}, retrying:`, raw.slice(0, 500));
    }
    if (tooSimilar) return NextResponse.json({ tooSimilar: true }, { status: 409 });
    return NextResponse.json({ error: "generation failed" }, { status: 502 });
  } catch (e) {
    console.error("[POST english/gapfill error]", e);
    return NextResponse.json({ error: "generation failed" }, { status: 500 });
  }
}
