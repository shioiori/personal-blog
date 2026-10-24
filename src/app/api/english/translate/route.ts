import { NextRequest, NextResponse } from "next/server";

// Best-effort, optional auto-translation. Must never throw — on any failure
// it returns { translation: null }.
//
// Primary: Google Translate's unofficial public endpoint (no API key). It is
// an actual MT model rather than a translation-memory lookup, which in
// practice gives noticeably better results for single words/short phrases
// than the earlier MyMemory-only approach (MyMemory occasionally returns
// badly wrong matches from its crowd-sourced corpus, e.g. "fission" ->
// "fishing"-flavoured text). MyMemory is kept as a fallback if Google's
// endpoint is unreachable.

async function translateWithGoogle(text: string): Promise<string | null> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  // Shape: [[["<translation>", "<source>", ...], ...], ...]
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const translation = (data[0] as unknown[])
    .map((segment) => (Array.isArray(segment) ? (segment[0] as string | undefined) : undefined))
    .filter((s): s is string => typeof s === "string")
    .join("");
  return translation.trim() || null;
}

async function translateWithMyMemory(text: string): Promise<string | null> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|vi`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = (await res.json()) as { responseData?: { translatedText?: string }; responseStatus?: number };
  const translation = data.responseData?.translatedText;
  const looksLikeQuotaWarning = !!translation && /MYMEMORY WARNING|QUOTA|USED ALL AVAILABLE/i.test(translation);
  if (!translation || looksLikeQuotaWarning || data.responseStatus !== 200) return null;
  if (translation.trim().toLowerCase() === text.trim().toLowerCase()) return null;
  return translation;
}

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text: string };
    const trimmed = text?.trim();
    if (!trimmed) {
      return NextResponse.json({ translation: null });
    }

    try {
      const translation = await translateWithGoogle(trimmed);
      if (translation && translation.toLowerCase() !== trimmed.toLowerCase()) {
        return NextResponse.json({ translation });
      }
    } catch (e) {
      console.error("[POST english/translate] google failed, falling back", e);
    }

    const fallback = await translateWithMyMemory(trimmed);
    return NextResponse.json({ translation: fallback });
  } catch (e) {
    console.error("[POST english/translate best-effort failure]", e);
    return NextResponse.json({ translation: null });
  }
}
