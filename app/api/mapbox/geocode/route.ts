import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { geocode } from "@/lib/mapbox";

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(Number(limitParam) || 5, 1), 10) : 5;

  const proxLat = url.searchParams.get("proximityLat");
  const proxLng = url.searchParams.get("proximityLng");
  const proximity =
    proxLat && proxLng && Number.isFinite(Number(proxLat)) && Number.isFinite(Number(proxLng))
      ? { lat: Number(proxLat), lng: Number(proxLng) }
      : undefined;

  const results = await geocode(q, { limit, proximity });
  return NextResponse.json({ results });
}
