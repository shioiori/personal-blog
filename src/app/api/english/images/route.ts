import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { fetchRemoteImage, uploadImage } from "@/src/lib/english-images";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    const form = await req.formData();
    const file = form.get("file");
    const url = form.get("url");
    let image: { body: Uint8Array; contentType: string };
    if (typeof url === "string" && url) {
      try {
        image = await fetchRemoteImage(url, MAX_BYTES);
      } catch {
        return NextResponse.json({ error: "cannot fetch image from url" }, { status: 400 });
      }
    } else if (file instanceof Blob && file.type.startsWith("image/")) {
      if (file.size > MAX_BYTES) return NextResponse.json({ error: "image too large" }, { status: 413 });
      image = { body: new Uint8Array(await file.arrayBuffer()), contentType: file.type };
    } else {
      return NextResponse.json({ error: "image file or url is required" }, { status: 400 });
    }
    const key = await uploadImage(userId, image.body, image.contentType);
    return NextResponse.json({ key });
  } catch (e) {
    console.error("[POST english/images error]", e);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
