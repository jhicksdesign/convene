import { NextResponse } from "next/server";
import { requireUser, isAdminOf } from "@/lib/auth-helpers";
import { suggestDates } from "@/lib/llm/assistant";
import { LLMRateLimitError } from "@/lib/anthropic";

export async function POST(req: Request) {
  const user = await requireUser();
  const { groupId, question } = await req.json();
  if (!groupId || !question) return NextResponse.json({ error: "groupId and question required" }, { status: 400 });
  if (!(await isAdminOf(user.id, groupId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const suggestions = await suggestDates(user.id, groupId, question);
    return NextResponse.json({ suggestions });
  } catch (e) {
    if (e instanceof LLMRateLimitError) {
      return NextResponse.json({ error: "rate_limit", resetAt: e.resetAt }, { status: 429 });
    }
    throw e;
  }
}
