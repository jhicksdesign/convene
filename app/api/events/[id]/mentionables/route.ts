import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { canSeeEvent, blockedUserIds } from "@/lib/visibility";

// People the viewer can @mention on this event: members of the owning or
// co-hosting groups, matching the query, minus blocked users and self. Scoped
// (not a global user search) so mentions stay within the event's audience.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const event = await db.event.findUnique({
    where: { id },
    select: { id: true, scope: true, owningGroupId: true, coHosts: { select: { groupId: true } } },
  });
  if (!event) return NextResponse.json({ results: [] });
  if (!(await canSeeEvent(user.id, event))) return NextResponse.json({ results: [] });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });

  const groupIds = [event.owningGroupId, ...event.coHosts.map((c) => c.groupId)];
  const blocked = await blockedUserIds(user.id);

  const members = await db.user.findMany({
    where: {
      id: { not: user.id, notIn: [...blocked] },
      deletedAt: null,
      displayName: { contains: q, mode: "insensitive" },
      memberships: { some: { groupId: { in: groupIds } } },
    },
    select: { id: true, displayName: true, avatarUrl: true },
    take: 8,
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json({ results: members });
}
