import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { extractEventFromText } from "@/lib/llm/extract-event";
import { LLMRateLimitError } from "@/lib/anthropic";

export async function POST(req: Request) {
  const user = await requireUser();
  const { text } = await req.json();
  if (typeof text !== "string") return NextResponse.json({ error: "text required" }, { status: 400 });
  try {
    const result = await extractEventFromText(user.id, text);
    return NextResponse.json({ result });
  } catch (e) {
    if (e instanceof LLMRateLimitError) {
      return NextResponse.json({ error: "rate_limit", resetAt: e.resetAt }, { status: 429 });
    }
    throw e;
  }
}
