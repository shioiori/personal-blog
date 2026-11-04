import { randomUUID } from "crypto";
import { lookup } from "dns/promises";
import { BlockList } from "net";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.ENGLISH_IMAGES_BUCKET ?? "";
const READ_URL_TTL = 600;

let client: S3Client | null = null;

function s3(): S3Client {
  client ??= new S3Client({
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    forcePathStyle: true,
  });
  return client;
}

function userPrefix(userId: number): string {
  return `english/${userId}/`;
}

export function ownsImage(userId: number, key: string): boolean {
  return key.startsWith(userPrefix(userId)) && !key.includes("..");
}

export async function uploadImage(userId: number, body: Uint8Array, contentType: string): Promise<string> {
  const ext = contentType.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "bin";
  const key = `${userPrefix(userId)}${randomUUID()}.${ext}`;
  await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  return key;
}

export async function getImageReadUrl(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: READ_URL_TTL });
}

export async function deleteImages(userId: number, keys: string[]): Promise<void> {
  const own = keys.filter((k) => ownsImage(userId, k));
  if (own.length === 0) return;
  try {
    await s3().send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: own.map((Key) => ({ Key })) } }));
  } catch (e) {
    console.error("[english images] delete failed", e);
  }
}

const blocked = new BlockList();
([["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16]] as const)
  .forEach(([a, p]) => blocked.addSubnet(a, p, "ipv4"));
([["::", 128], ["::1", 128],["fc00::", 7], ["fe80::", 10]] as const)
  .forEach(([a, p]) => blocked.addSubnet(a, p, "ipv6"));

async function assertPublicHost(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid url");
  const addrs = await lookup(url.hostname, { all: true });
  if (addrs.length === 0 || addrs.some((a) => blocked.check(a.address, a.family === 6 ? "ipv6" : "ipv4"))) throw new Error("blocked host");
}

export async function fetchRemoteImage(raw: string, maxBytes: number) {
  let url = new URL(raw);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    const contentType = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!res.ok || !contentType.startsWith("image/")) throw new Error("not an image");
    if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw new Error("too large");
    const body = new Uint8Array(await res.arrayBuffer());
    if (body.byteLength > maxBytes) throw new Error("too large");
    return { body, contentType };
  }
  throw new Error("too many redirects");
}
