import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { directions } from "@/lib/mapbox";

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const me = await db.user.findUnique({ where: { id: user.id }, select: { homeLat: true, homeLng: true } });
  if (!me?.homeLat || !me?.homeLng) return NextResponse.json({ result: null });

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { location: { select: { lat: true, lng: true } } },
  });
  if (!event?.location) return NextResponse.json({ result: null });

  const result = await directions({ lat: me.homeLat, lng: me.homeLng }, event.location);
  return NextResponse.json({ result });
}
