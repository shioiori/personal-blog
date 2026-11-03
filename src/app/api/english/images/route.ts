import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { uploadImage } from "@/src/lib/english-images";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof Blob) || !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "image file is required" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "image too large" }, { status: 413 });
    }
    const key = await uploadImage(userId, new Uint8Array(await file.arrayBuffer()), file.type);
    return NextResponse.json({ key });
  } catch (e) {
    console.error("[POST english/images error]", e);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
