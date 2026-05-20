import { NextResponse } from "next/server";
import { readTicks } from "@/lib/realtime";

// GET /api/realtime/ticks?c=calendar&c=event:abc123 → { "calendar": ISO, "event:abc123": ISO }
export async function GET(req: Request) {
  const url = new URL(req.url);
  const channels = url.searchParams.getAll("c").slice(0, 20);
  const ticks = await readTicks(channels);
  return NextResponse.json(ticks, {
    headers: { "Cache-Control": "no-store" },
  });
}
