import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { geocode } from "@/lib/mapbox";

export async function GET(req: Request) {
  await requireUser();
  const q = new URL(req.url).searchParams.get("q");
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });
  const result = await geocode(q);
  return NextResponse.json({ result });
}
