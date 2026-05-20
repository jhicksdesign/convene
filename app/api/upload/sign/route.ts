import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { signedUploadUrl, type UploadKind } from "@/lib/r2";
import { rateLimitForUser, RateLimitError } from "@/lib/rate-limit";

const KINDS = new Set<UploadKind>(["avatar", "flyer", "evidence"]);

export async function POST(req: Request) {
  const user = await requireUser();
  const { kind, mime, sizeBytes } = await req.json();
  if (!KINDS.has(kind)) return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  try {
    await rateLimitForUser(user.id, `upload:${kind}`, 30, 60 * 60_000);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: e.message, retryAt: e.retryAt }, { status: 429 });
    }
    throw e;
  }
  const result = await signedUploadUrl(kind, user.id, mime, sizeBytes);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
