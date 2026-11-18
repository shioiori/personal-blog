import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, getWord } from "@/src/lib/english-db";
import { ensureWritingTables, upsertWritingGrade } from "@/src/lib/english-writing-db";
import { getCurrentUser, isPremium, unauthorized } from "@/src/lib/auth";
import { aiComplete, PremiumRequiredError } from "@/src/lib/ai-complete";

const MODEL = "openai/gpt-oss-120b";
const MAX_SENTENCE_LENGTH = 300;

const SYSTEM_PROMPT =
  "Bạn là giáo viên tiếng Anh chấm câu văn của học viên một cách khách quan, nghiêm khắc nhưng công bằng. Luôn trả lời bằng JSON hợp lệ.";

const PROMPT = (word: string, meaningVi: string, example: string, sentence: string) => `Học viên đang học từ tiếng Anh: "${word}" (nghĩa tiếng Việt: ${meaningVi}).${example ? ` Ví dụ tham khảo: "${example}"` : ""}

Học viên vừa đặt câu sau để chứng tỏ họ nhớ và dùng được từ này:
"${sentence}"

Hãy đánh giá theo đúng 3 tiêu chí sau:
1. "usedWord": câu có thực sự dùng từ/cụm từ "${word}" (hoặc biến thể ngữ pháp hợp lệ của nó, ví dụ số nhiều, chia động từ) không?
2. "correctWord": từ dùng trong câu có đúng là từ đang hỏi không (không bị nhầm với từ khác viết gần giống, không sai chính tả nghiêm trọng)?
3. "correctContext": từ có được dùng ĐÚNG NGỮ CẢNH, đúng sắc thái nghĩa, đúng loại từ, đúng cấu trúc ngữ pháp thường đi kèm của từ đó không? (nhiều từ chỉ dùng được trong một số ngữ cảnh/cấu trúc nhất định — nếu câu dùng sai sắc thái, sai ngữ cảnh dù đúng từ thì tiêu chí này KHÔNG đạt).

Dựa trên 3 tiêu chí trên, đánh giá "grade" — mức độ học viên THỰC SỰ NHỚ VÀ DÙNG ĐÚNG từ này — chọn đúng một trong 4 giá trị:
- "forget": không dùng từ trong câu, hoặc dùng sai hẳn thành từ khác.
- "hard": có dùng từ nhưng sai ngữ cảnh/ngữ pháp rõ rệt, hoặc câu quá sơ sài/không thể hiện hiểu nghĩa.
- "good": dùng đúng từ, đúng ngữ cảnh cơ bản, có thể còn vài lỗi nhỏ không đáng kể.
- "easy": dùng đúng từ, đúng ngữ cảnh, câu tự nhiên, trôi chảy như người bản ngữ.

"feedback": CHỈ viết góp ý bằng tiếng Việt, ngắn gọn (1-2 câu), khi có ÍT NHẤT MỘT trong 3 tiêu chí usedWord/correctWord/correctContext không đạt (false) — giải thích ngắn gọn vì sao và gợi ý sửa. Nếu CẢ 3 tiêu chí đều đạt (true), để "feedback" là chuỗi rỗng "".

Trả về CHỈ một JSON object: {"usedWord": true/false, "correctWord": true/false, "correctContext": true/false, "grade": "forget"|"hard"|"good"|"easy", "feedback": "..."}`;

const GRADE_MAP: Record<string, 0 | 1 | 2 | 3> = { forget: 0, hard: 1, good: 2, easy: 3 };

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const premium = isPremium(user);
  if (!premium) return NextResponse.json({ needsPremium: true }, { status: 403 });

  let body: { wordId?: unknown; sentence?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const wordId = typeof body.wordId === "number" ? body.wordId : null;
  const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";
  if (!wordId || !sentence) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (sentence.length > MAX_SENTENCE_LENGTH) return NextResponse.json({ error: "too long" }, { status: 400 });

  try {
    await ensureEnglishTables();
    await ensureWritingTables();
    const word = await getWord(user.id, wordId);
    if (!word) return NextResponse.json({ error: "not found" }, { status: 404 });
    const meaningVi = word.senses.map((s) => s.meaningVi).filter(Boolean).join("; ");
    const example = word.senses.find((s) => s.example)?.example ?? "";

    const { raw } = await aiComplete({
      groqModel: MODEL,
      maxTokens: 512,
      temperature: 0.2,
      reasoningEffort: "medium",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: PROMPT(word.word, meaningVi, example, sentence),
      isPremium: premium,
    });

    const parsed = JSON.parse(raw) as {
      usedWord?: unknown;
      correctWord?: unknown;
      correctContext?: unknown;
      grade?: unknown;
      feedback?: unknown;
    };
    const usedWord = parsed.usedWord === true;
    const correctWord = parsed.correctWord === true;
    const correctContext = parsed.correctContext === true;
    const grade = GRADE_MAP[String(parsed.grade ?? "").toLowerCase()] ?? (usedWord && correctWord && correctContext ? 2 : 0);
    const feedback = typeof parsed.feedback === "string" ? parsed.feedback.trim() : "";

    await upsertWritingGrade(user.id, wordId, grade);

    return NextResponse.json({ usedWord, correctWord, correctContext, feedback });
  } catch (e) {
    if (e instanceof PremiumRequiredError) return NextResponse.json({ needsPremium: true }, { status: 403 });
    console.error("[POST english/writing/check error]", e);
    return NextResponse.json({ error: "check failed" }, { status: 500 });
  }
}
