import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { getImageReadUrl, ownsImage } from "@/src/lib/english-images";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const key = (await params).key.join("/");
  if (!ownsImage(userId, key)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.redirect(await getImageReadUrl(key), { status: 302, headers: { "Cache-Control": "private, max-age=300" } });
}
