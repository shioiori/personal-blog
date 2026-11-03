import { randomUUID } from "crypto";
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
