import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getUserId, unauthorized } from "@/src/lib/auth";

// Best-effort lemmatization used by the extension's quick-add before
// crawling/saving a word — e.g. "depends" should be looked up and saved as
// "depend", so repeated inflected forms of the same word don't end up as
// separate entries. Only normalizes a single inflected word (plural, verb
// tense, comparative/superlative); a multi-word selection, phrase, or idiom
// is returned unchanged, since splitting those into a "base form" would
// usually be wrong.

const MODEL = "openai/gpt-oss-20b";

export async function POST(req: NextRequest) {
  if (!(await getUserId())) return unauthorized();

  let body: { word?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const word = body.word?.trim();
  if (!word) return NextResponse.json({ lemma: "" });

  // Only ever worth asking for a single word — a phrase/idiom is passed
  // through untouched without spending a model call on it.
  if (/\s/.test(word)) return NextResponse.json({ lemma: word });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ lemma: word, error: "GROQ_API_KEY not configured" });
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 64,
      temperature: 0,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Bạn chuẩn hoá một từ tiếng Anh về dạng từ điển gốc (lemma): số nhiều -> số ít, động từ chia thì -> nguyên mẫu, so sánh hơn/nhất -> tính từ gốc. Nếu từ đã ở dạng gốc, giữ nguyên. Luôn trả lời JSON dạng {"lemma": "..."}.',
        },
        { role: "user", content: `Từ: "${word}"` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { lemma?: unknown };
    const lemma = String(parsed.lemma ?? "").trim();
    // Guard against the model wandering off (returning a sentence, a
    // completely different word, empty, etc.) — only accept a single
    // alphabetic token close in length to the input.
    const isPlausible = /^[a-zA-Z'-]+$/.test(lemma) && lemma.length > 0 && lemma.length <= word.length + 2;
    return NextResponse.json({ lemma: isPlausible ? lemma.toLowerCase() : word });
  } catch (e) {
    console.error("[POST english/lemmatize error]", e);
    return NextResponse.json({ lemma: word, error: "lemmatize failed" });
  }
}
