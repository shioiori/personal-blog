import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isPremium, unauthorized } from "@/src/lib/auth";
import { aiComplete, PremiumRequiredError } from "@/src/lib/ai-complete";
import type { EssaySpellIssue } from "@/src/declaration/english";

const MODEL = "openai/gpt-oss-120b";
const MAX_TEXT_LENGTH = 6000;

const SYSTEM_PROMPT =
  "Bạn là giáo viên tiếng Anh IELTS, kiểm tra lỗi chính tả và ngữ pháp trong bài luận của học viên một cách kỹ lưỡng. Luôn trả lời bằng JSON hợp lệ.";

const PROMPT = (text: string) => `Dưới đây là một bài luận tiếng Anh (IELTS Writing Task 2) của học viên:

"""
${text}
"""

Hãy tìm TẤT CẢ lỗi chính tả (spelling) và lỗi ngữ pháp (grammar) trong bài. Với mỗi lỗi, trả về:
- "original": đoạn văn bản gốc bị sai, trích NGUYÊN VĂN (ngắn gọn, chỉ phần bị sai, đủ để tìm lại chính xác trong văn bản gốc bằng cách so khớp chuỗi).
- "suggestion": đoạn văn bản đã sửa đúng, thay thế cho "original".
- "type": "spelling" hoặc "grammar".
- "explanation": giải thích ngắn gọn bằng tiếng Việt vì sao sai.

Nếu không có lỗi nào, trả về mảng rỗng.

Trả về CHỈ một JSON object: {"issues": [{"original": "...", "suggestion": "...", "type": "spelling"|"grammar", "explanation": "..."}]}`;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const premium = isPremium(user);
  if (!premium) return NextResponse.json({ needsPremium: true }, { status: 403 });

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ issues: [] });
  if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: "too long" }, { status: 400 });

  try {
    const { raw } = await aiComplete({
      groqModel: MODEL,
      maxTokens: 2048,
      temperature: 0.2,
      reasoningEffort: "medium",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: PROMPT(text),
      isPremium: premium,
    });

    const parsed = JSON.parse(raw) as { issues?: unknown };
    const rawIssues = Array.isArray(parsed.issues) ? parsed.issues : [];
    const issues: EssaySpellIssue[] = rawIssues
      .filter(
        (i): i is Record<string, unknown> =>
          !!i && typeof i === "object" && typeof (i as Record<string, unknown>).original === "string",
      )
      .map((i) => ({
        original: String(i.original),
        suggestion: typeof i.suggestion === "string" ? i.suggestion : "",
        type: i.type === "grammar" ? "grammar" : "spelling",
        explanation: typeof i.explanation === "string" ? i.explanation : "",
      }));

    return NextResponse.json({ issues });
  } catch (e) {
    if (e instanceof PremiumRequiredError) return NextResponse.json({ needsPremium: true }, { status: 403 });
    console.error("[POST english/essay/spellcheck error]", e);
    return NextResponse.json({ error: "spellcheck failed" }, { status: 500 });
  }
}
