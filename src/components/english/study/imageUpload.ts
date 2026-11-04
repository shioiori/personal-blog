export type PendingImage = { previewUrl: string } & ({ blob: Blob } | { url: string });

export function imageUrl(key: string): string {
  return `/api/english/images/${key}`;
}

export async function compressImage(file: File, maxSize = 1200, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export async function uploadImage(p: PendingImage): Promise<string> {
  const form = new FormData();
  if ("blob" in p) form.append("file", p.blob);
  else form.append("url", p.url);
  const res = await fetch("/api/english/images", { method: "POST", body: form });
  const data = (await res.json()) as { key?: string; error?: string };
  if (!res.ok || !data.key) throw new Error(data.error ?? "upload failed");
  return data.key;
}
