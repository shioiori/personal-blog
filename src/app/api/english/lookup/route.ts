import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isPremium, unauthorized } from "@/src/lib/auth";
import { aiComplete, PremiumRequiredError } from "@/src/lib/ai-complete";

const MODEL = "openai/gpt-oss-120b";
const MAX_TEXT_LENGTH = 1000;

const SYSTEM_PROMPT =
  "Bạn là trợ lý tra cứu/dịch thuật Anh-Việt song hướng, chính xác và tự nhiên. Luôn trả lời bằng JSON hợp lệ.";

const PROMPT = (text: string, explain: boolean) => `Người dùng gõ vào ô tra cứu nhanh nội dung sau (có thể là tiếng Việt hoặc tiếng Anh, một từ/cụm từ hoặc một câu):

"""
${text}
"""

Nhiệm vụ:
1. Nếu nội dung là tiếng Việt: dịch sang tiếng Anh tự nhiên, đúng ngữ cảnh (ưu tiên cụm từ/thành ngữ tiếng Anh tương đương nếu có, không dịch word-by-word).
2. Nếu nội dung là tiếng Anh: dịch sang tiếng Việt đúng nghĩa, tự nhiên.

${explain ? 'Đồng thời giải thích ngắn gọn (field "explanation", bằng tiếng Việt, tối đa 3 câu) về sắc thái nghĩa, cách dùng, hoặc vì sao dịch như vậy.' : 'Không cần giải thích, để "explanation" là chuỗi rỗng.'}

Trả về CHỈ một JSON object: {"result": "<bản dịch>", "explanation": "..."}`;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const premium = isPremium(user);

  let body: { text?: unknown; explain?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const explain = body.explain === true;
  if (!text) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: "too long" }, { status: 400 });

  try {
    const { raw } = await aiComplete({
      groqModel: MODEL,
      maxTokens: 512,
      temperature: 0.3,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: PROMPT(text, explain),
      isPremium: premium,
    });

    const parsed = JSON.parse(raw) as { result?: unknown; explanation?: unknown };
    const result = typeof parsed.result === "string" ? parsed.result.trim() : "";
    const explanation = explain && typeof parsed.explanation === "string" ? parsed.explanation.trim() : "";

    return NextResponse.json({ result, explanation });
  } catch (e) {
    if (e instanceof PremiumRequiredError) return NextResponse.json({ needsPremium: true }, { status: 403 });
    console.error("[POST english/lookup error]", e);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
