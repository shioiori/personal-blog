import { NextRequest, NextResponse } from "next/server";

// jjwxc serves its per-chapter obfuscation fonts without CORS headers, so the
// browser can't fetch them directly. This proxies the download with the
// Referer jjwxc requires.
const FONT_NAME = /^jjwxcfont_[0-9a-z]+$/i;

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!FONT_NAME.test(name)) {
    return NextResponse.json({ error: "Invalid font name" }, { status: 400 });
  }

  const upstream = await fetch(
    `https://static.jjwxc.net/tmp/fonts/${name}.woff2?h=my.jjwxc.net`,
    { headers: { Referer: "https://my.jjwxc.net/", "User-Agent": "Mozilla/5.0" } }
  );

  if (!upstream.ok) {
    return NextResponse.json({ error: "Font not found" }, { status: upstream.status });
  }

  const buffer = await upstream.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "font/woff2",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
