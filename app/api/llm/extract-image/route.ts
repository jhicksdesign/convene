import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { extractEventFromImage } from "@/lib/llm/extract-event";
import { LLMRateLimitError } from "@/lib/anthropic";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export async function POST(req: Request) {
  const user = await requireUser();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (!ALLOWED.includes(file.type as (typeof ALLOWED)[number])) {
    return NextResponse.json({ error: "unsupported media type" }, { status: 415 });
  }
  const buf = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const result = await extractEventFromImage(user.id, buf, file.type as (typeof ALLOWED)[number]);
    return NextResponse.json({ result });
  } catch (e) {
    if (e instanceof LLMRateLimitError) {
      return NextResponse.json({ error: "rate_limit", resetAt: e.resetAt }, { status: 429 });
    }
    throw e;
  }
}
