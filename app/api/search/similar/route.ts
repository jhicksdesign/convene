import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { filterVisibleEvents } from "@/lib/visibility";
import { similarEventIds } from "@/lib/embeddings";

export async function GET(req: Request) {
  const me = await getCurrentUser();
  const url = new URL(req.url);
  const seed = url.searchParams.get("eventId");
  if (!seed) return NextResponse.json({ results: [] });

  const ids = await similarEventIds(seed, 12);
  if (ids.length === 0) return NextResponse.json({ results: [] });

  const events = await db.event.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, title: true, scope: true, owningGroupId: true, startsAt: true,
      owningGroup: { select: { name: true, color: true } },
    },
  });
  const visible = await filterVisibleEvents(me?.id ?? null, events);
  // Preserve the ANN ordering.
  const byId = new Map(visible.map((e) => [e.id, e]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean).slice(0, 6);

  return NextResponse.json({
    results: ordered.map((e) => ({
      id: e!.id,
      title: e!.title,
      groupName: e!.owningGroup.name,
      color: e!.owningGroup.color,
      startsAt: e!.startsAt.toISOString(),
    })),
  });
}
