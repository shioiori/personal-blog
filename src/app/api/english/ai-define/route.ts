import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { aiComplete } from "@/src/lib/ai-complete";

// Last-resort fallback for word-add: used only when BOTH dictionaryapi.dev
// and the Wiktionary fallback (see /api/english/crawl) returned nothing —
// e.g. an uncommon phrasal verb like "creep into" that isn't indexed as its
// own entry anywhere free. Lets Groq define it from its own knowledge
// instead of blocking the add outright. Every returned sense is tagged with
// a `note` so it's visually obvious in the app that this wasn't sourced from
// a dictionary and may be worth double-checking.
//
// The model is explicitly told to return nothing if it isn't confident this
// is a real English word/phrase, rather than invent a definition — this
// matters more here than elsewhere since there's no dictionary data to
// cross-check against at all.

const MODEL = "openai/gpt-oss-120b";
const AI_NOTE = "Định nghĩa do AI tạo (không tìm thấy trong từ điển) — nên kiểm tra lại.";

interface AiSense {
  partOfSpeech?: string;
  cambridgeMeaning?: string;
  meaningVi?: string;
  example?: string;
  synonyms?: string;
  antonyms?: string;
}

// Phonetic is never requested here — it always comes from the real
// dictionary lookup (dictionaryapi.dev, via `knownIpa` in english-autofill.ts),
// never invented by the model, so it's dropped from both prompt and schema
// to save tokens.
const PROMPT = (word: string) => `Từ/cụm từ tiếng Anh: "${word}"

Không tìm được từ/cụm từ này trong các từ điển tự động (dictionaryapi.dev, Wiktionary). Bạn phải tự xác định TOÀN BỘ thông tin dưới đây hoàn toàn từ kiến thức của bạn — không có dữ liệu từ điển nào để tham khảo thêm.

BƯỚC 1 — KIỂM TRA TỒN TẠI (bắt buộc làm trước, nghiêm ngặt):
Từ/cụm từ này có THẬT SỰ TỒN TẠI trong tiếng Anh không (không phải lỗi chính tả, không phải chuỗi ký tự ngẫu nhiên, không phải tiếng khác)? Nếu có BẤT KỲ nghi ngờ nào, trả về NGAY {"senses": []} và DỪNG LẠI. TUYỆT ĐỐI KHÔNG được bịa ra một định nghĩa nghe có vẻ hợp lý cho một từ không tồn tại hoặc bạn không chắc chắn — thà trả về rỗng còn hơn bịa đặt.

BƯỚC 2 — nếu chắc chắn tồn tại, liệt kê TẤT CẢ các nghĩa thường dùng (không giới hạn số lượng), bỏ nghĩa hiếm/cổ/rất ít khi được dùng. Mỗi nghĩa là MỘT OBJECT với ĐẦY ĐỦ, CHÍNH XÁC các trường sau (dùng "" cho trường không áp dụng được, KHÔNG được bỏ trường):
- "partOfSpeech": loại từ, chữ thường tiếng Anh (noun, verb, adjective, adverb, idiom, phrasal verb...).
- "cambridgeMeaning": định nghĩa tiếng Anh ngắn gọn, CHÍNH XÁC VỀ MẶT NGỮ NGHĨA, viết đúng kiểu một cuốn từ điển Anh-Anh (không phải giải thích dài dòng).
- "meaningVi": nghĩa tiếng Việt NGẮN GỌN kiểu từ điển Anh-Việt thật, KHÔNG dịch nguyên câu định nghĩa tiếng Anh, KHÔNG bịa từ không có trong tiếng Việt.
- "example": một câu ví dụ tiếng Anh ngắn, tự nhiên, đúng ngữ pháp, minh hoạ ĐÚNG nghĩa đang xét.
- "synonyms": các từ đồng nghĩa phổ biến, thật sự tồn tại, phân cách bởi dấu phẩy. Để "" nếu không có từ nào thật sự đồng nghĩa — KHÔNG bịa.
- "antonyms": tương tự "synonyms" nhưng là từ trái nghĩa.

Trả về CHỈ một JSON object đúng định dạng: {"senses": [{"partOfSpeech": "...", "cambridgeMeaning": "...", "meaningVi": "...", "example": "...", "synonyms": "...", "antonyms": "..."}, ...]}. Không thêm bất kỳ chữ giải thích nào ngoài JSON.`;

export async function POST(req: NextRequest) {
  if (!(await getUserId())) return unauthorized();

  let body: { word?: string };
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

  try {
    const { raw } = await aiComplete({
      groqModel: MODEL,
      maxTokens: 2048,
      temperature: 0.3,
      reasoningEffort: "medium",
      systemPrompt:
        "Bạn là một biên tập viên từ điển Anh-Việt thận trọng: chỉ đưa ra định nghĩa khi chắc chắn từ/cụm từ đó thực sự tồn tại, không bao giờ bịa đặt. Luôn trả lời bằng JSON hợp lệ.",
      userPrompt: PROMPT(word),
    });
    const parsed = JSON.parse(raw) as { senses?: unknown };
    const rawSenses = Array.isArray(parsed.senses) ? parsed.senses : [];

    const senses = rawSenses
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const item = s as AiSense;
        const cambridgeMeaning = String(item.cambridgeMeaning ?? "").trim();
        const meaningVi = String(item.meaningVi ?? "").trim();
        if (!cambridgeMeaning || !meaningVi) return null;
        return {
          partOfSpeech: String(item.partOfSpeech ?? "").trim(),
          cambridgeMeaning,
          meaningVi,
          example: String(item.example ?? "").trim(),
          synonyms: String(item.synonyms ?? "").trim(),
          antonyms: String(item.antonyms ?? "").trim(),
          note: AI_NOTE,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return NextResponse.json({ senses });
  } catch (e) {
    console.error("[POST english/ai-define error]", e);
    return NextResponse.json({ senses: [], error: "ai-define failed" });
  }
}
