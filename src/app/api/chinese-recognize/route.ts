import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { ink, width, height } = await req.json();

    if (!ink || !Array.isArray(ink) || ink.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const requestBody = JSON.stringify({
      requests: [
        {
          writing_guide: {
            writing_area_width: width ?? 300,
            writing_area_height: height ?? 300
          },
          ink,
          language: "zh-Hans"
        }
      ]
    });

    const response = await fetch(
      "https://inputtools.google.com/request?text=&ime=handwriting&app=translate&dbg=0&cs=1&oe=UTF-8",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody
      }
    );

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const data = await response.json();

    // Response: ["SUCCESS", [[request_id, ["char1","char2",...], [], {...}]]]
    const raw: string[] = data?.[1]?.[0]?.[1] ?? [];

    // Keep only single Chinese characters
    const suggestions = raw.filter(
      (s) => s.length === 1 && /\p{Script=Han}/u.test(s)
    );

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
