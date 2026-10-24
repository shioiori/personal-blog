import { NextRequest, NextResponse } from "next/server";

// Best-effort, optional auto-translation using the free MyMemory API (no API key).
// This is intentionally isolated so it's easy to rip out or swap for another
// provider later. Must never throw — on any failure it returns { translation: null }.
export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text: string };
    if (!text?.trim()) {
      return NextResponse.json({ translation: null });
    }

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=en|vi`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return NextResponse.json({ translation: null });

    const data = (await res.json()) as { responseData?: { translatedText?: string }; responseStatus?: number };
    const translation = data.responseData?.translatedText;
    const looksLikeQuotaWarning = !!translation && /MYMEMORY WARNING|QUOTA|USED ALL AVAILABLE/i.test(translation);
    if (!translation || looksLikeQuotaWarning || data.responseStatus !== 200 || translation.trim().toLowerCase() === text.trim().toLowerCase()) {
      return NextResponse.json({ translation: looksLikeQuotaWarning ? null : (translation ?? null) });
    }
    return NextResponse.json({ translation });
  } catch (e) {
    console.error("[POST english/translate best-effort failure]", e);
    return NextResponse.json({ translation: null });
  }
}
