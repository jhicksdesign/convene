// Cloudflare R2 (S3-compatible). Avatars, flyers, evidence.
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";

const accountId = process.env.R2_ACCOUNT_ID ?? "";
const bucket = process.env.R2_BUCKET ?? "convene";

export const r2 = new S3Client({
  region: "auto",
  endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

export type UploadKind = "avatar" | "flyer" | "evidence" | "comment";

const limits: Record<UploadKind, { maxBytes: number; mimes: string[] }> = {
  avatar:   { maxBytes: 5 * 1024 * 1024,  mimes: ["image/png", "image/jpeg", "image/webp"] },
  flyer:    { maxBytes: 10 * 1024 * 1024, mimes: ["image/png", "image/jpeg", "image/webp", "image/gif"] },
  evidence: { maxBytes: 10 * 1024 * 1024, mimes: ["image/png", "image/jpeg", "image/webp", "application/pdf", "video/mp4"] },
  comment:  { maxBytes: 10 * 1024 * 1024, mimes: ["image/png", "image/jpeg", "image/webp", "image/gif"] },
};

export async function signedUploadUrl(
  kind: UploadKind,
  ownerId: string,
  mime: string,
  sizeBytes: number,
): Promise<{ url: string; publicUrl: string; key: string } | { error: string }> {
  const cfg = limits[kind];
  if (sizeBytes > cfg.maxBytes) return { error: `File exceeds ${cfg.maxBytes} bytes` };
  if (!cfg.mimes.includes(mime)) return { error: `Mime ${mime} not allowed` };

  const key = `${kind}/${ownerId}/${Date.now()}-${randomBytes(8).toString("hex")}`;
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mime });
  const url = await getSignedUrl(r2, cmd, { expiresIn: 600 });
  const publicBase = process.env.R2_PUBLIC_URL ?? "";
  return { url, publicUrl: `${publicBase}/${key}`, key };
}
