import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { aiComplete } from "@/src/lib/ai-complete";

// Validates + normalizes a selected text before the extension's quick-add
// crawls/saves it. Rejects (valid: false) anything that isn't a legitimate
// single dictionary entry to add:
// - blank / meaningless or gibberish text
// - not actually English (Vietnamese, another language, random characters)
// - a full sentence rather than a word, idiom, phrasal verb, or other short
//   fixed expression (e.g. "break the ice" is fine, "I think this is a
//   great idea" is not)
// When valid, also normalizes an inflected single word to its dictionary
// base form ("depends" -> "depend"); for a valid multi-word phrase/idiom,
// only the verb inside it (if any) is normalized the same way ("creeps
// into" -> "creep into"), the rest of the phrase is left as-is.

// See gloss/route.ts: 120b is measurably more reliable than 20b for
// Vietnamese/word-form output on this provider; cost difference is
// negligible at this usage volume.
const MODEL = "openai/gpt-oss-120b";

const PROMPT = (text: string) => `Người dùng vừa bôi đen đoạn text sau trên một trang web, định thêm vào từ điển học tiếng Anh cá nhân: "${text}"

Hãy đánh giá theo đúng các tiêu chí sau, THEO THỨ TỰ:
1. Đoạn text có rỗng, vô nghĩa, hoặc chỉ là ký tự/chữ lộn xộn không? Nếu có -> valid=false.
2. Đoạn text có phải tiếng Anh THẬT SỰ không (không phải tiếng Việt, ngôn ngữ khác)? Nếu không -> valid=false.
3. Đoạn text có phải là MỘT ĐƠN VỊ TỪ VỰNG phù hợp để tra từ điển không — tức là MỘT TỪ, hoặc một THÀNH NGỮ/CỤM ĐỘNG TỪ/CỤM CỐ ĐỊNH ngắn (ví dụ: "break the ice", "give up", "piece of cake")? KHÔNG PHẢI một CÂU HOÀN CHỈNH dài diễn đạt một ý trọn vẹn (có chủ ngữ + vị ngữ, giống một câu nói hoặc câu viết bình thường)? Nếu nó là một câu hoàn chỉnh (dù ngắn, ví dụ "I love you", "This is great") -> valid=false.

Nếu qua được CẢ 3 tiêu chí trên, trả về valid=true và "normalized":
- Nếu là MỘT TỪ bị chia (số nhiều, chia thì, so sánh hơn/nhất), đưa "normalized" về dạng từ điển gốc (vd "depends" -> "depend").
- Nếu là cụm từ/thành ngữ/cụm động từ (nhiều từ), và trong cụm có ĐỘNG TỪ bị chia thì/số, đưa riêng động từ đó về dạng nguyên mẫu, GIỮ NGUYÊN các từ còn lại trong cụm (vd "creeps into" -> "creep into", "gave up on" -> "give up on"). Nếu cụm đã ở dạng gốc hoặc không có động từ bị chia, giữ nguyên text gốc (chỉ chuẩn hoá chữ thường, bỏ khoảng trắng thừa).

Nếu KHÔNG qua một trong 3 tiêu chí, trả về valid=false kèm "reason" là MỘT CÂU NGẮN bằng tiếng Việt giải thích lý do (ví dụ: "Không phải tiếng Anh.", "Đây là một câu hoàn chỉnh, không phải từ hay cụm từ.", "Nội dung rỗng hoặc vô nghĩa.").

Trả về CHỈ một JSON object: {"valid": true/false, "normalized": "...", "reason": "..."}. Không thêm giải thích gì khác ngoài JSON.`;

export async function POST(req: NextRequest) {
  if (!(await getUserId())) return unauthorized();

  let body: { word?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const text = body.word?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ valid: false, normalized: "", reason: "Không có từ nào được chọn." });
  }

  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    // Can't validate without the model — fail closed: better to block a
    // legitimate add than to let something through unchecked.
    return NextResponse.json({ valid: false, normalized: text, reason: "Không kiểm tra được (thiếu cấu hình).", error: "GROQ_API_KEY not configured" });
  }

  try {
    const { raw } = await aiComplete({
      groqModel: MODEL,
      // "low" reasoning_effort measurably degrades this model's
      // Vietnamese/word-form output quality — see gloss/route.ts. "medium"
      // keeps that same accuracy here (tested across a dozen cases) while
      // leaving enough token budget at 1024 for this longer 3-criteria
      // validation prompt; "high" burned through 1024-2048 tokens on
      // reasoning alone for multi-word inputs, truncating the JSON output.
      maxTokens: 1024,
      temperature: 0,
      reasoningEffort: "medium",
      systemPrompt:
        "Bạn là bộ lọc kiểm tra text người dùng chọn để thêm vào từ điển cá nhân, và chuẩn hoá từ về dạng từ điển gốc. Luôn trả lời JSON hợp lệ, chính xác theo yêu cầu.",
      userPrompt: PROMPT(text),
    });
    const parsed = JSON.parse(raw) as { valid?: unknown; normalized?: unknown; reason?: unknown };
    const valid = parsed.valid === true;
    const reason = String(parsed.reason ?? "").trim();

    if (!valid) {
      return NextResponse.json({ valid: false, normalized: text, reason: reason || "Không hợp lệ để thêm vào từ điển." });
    }

    const normalized = String(parsed.normalized ?? "").trim();
    // Guard against the model wandering off (empty, or a wildly different/
    // much longer answer than the input) — fall back to the original text.
    const isPlausible = normalized.length > 0 && normalized.length <= text.length + 5;
    return NextResponse.json({ valid: true, normalized: isPlausible ? normalized.toLowerCase() : text.toLowerCase() });
  } catch (e) {
    console.error("[POST english/lemmatize error]", e);
    // Couldn't validate — fail closed: better to block a legitimate add
    // than to risk saving something that violates the rules unchecked.
    return NextResponse.json({ valid: false, normalized: text, reason: "Không kiểm tra được từ này, thử lại sau.", error: "validation failed" });
  }
}
