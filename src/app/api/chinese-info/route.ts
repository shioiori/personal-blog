import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const char = req.nextUrl.searchParams.get("char");

  if (!char) {
    return NextResponse.json({ error: "Missing char parameter" }, { status: 400 });
  }

  try {
    // Fetch translation + romanization from Google Translate unofficial API
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh&tl=en&dt=t&dt=rm&q=${encodeURIComponent(char)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    if (!response.ok) {
      return NextResponse.json({ char, pinyin: null, meaning: null });
    }

    const data = await response.json();

    // data[0][0][0] = translated meaning
    // data[0][0][3] = pinyin (for single char, sometimes present)
    const meaning: string = data?.[0]?.[0]?.[0] ?? null;

    // Romanization can appear in different positions depending on the response
    let pinyin: string | null = null;

    // Try common locations for pinyin/romanization
    if (data?.[0]?.[0]?.[3]) {
      pinyin = data[0][0][3];
    } else if (Array.isArray(data) && data.length > 0) {
      // Search for romanization block at the end of the response
      const last = data[data.length - 1];
      if (Array.isArray(last) && typeof last[0] === "string") {
        pinyin = last[0];
      } else if (Array.isArray(last) && Array.isArray(last[0])) {
        pinyin = last[0][0] ?? null;
      }
    }

    return NextResponse.json({ char, pinyin, meaning });
  } catch {
    return NextResponse.json({ char, pinyin: null, meaning: null });
  }
}
