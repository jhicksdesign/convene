import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { blockedUserIds, filterVisibleEvents } from "@/lib/visibility";

interface Hit { kind: "user" | "group" | "event"; id: string; title: string; sub?: string; href: string }

export async function GET(req: Request) {
  const me = await getCurrentUser();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const blocked = me ? await blockedUserIds(me.id) : new Set<string>();

  const [groups, users, eventCandidates] = await Promise.all([
    db.group.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
        visibility: me ? { in: ["PUBLIC_LISTED", "MEMBERS_VISIBLE"] } : "PUBLIC_LISTED",
      },
      select: { id: true, name: true, slug: true, color: true, _count: { select: { memberships: true } } },
      take: 8,
    }),
    me
      ? db.user.findMany({
          where: {
            deletedAt: null,
            id: { not: me.id, notIn: Array.from(blocked) },
            displayName: { contains: q, mode: "insensitive" },
          },
          select: { id: true, displayName: true, avatarUrl: true, searchable: true, memberships: { select: { groupId: true } } },
          take: 12,
        })
      : Promise.resolve([]),
    db.event.findMany({
      where: {
        title: { contains: q, mode: "insensitive" },
        cancelledAt: null,
        endsAt: { gte: new Date() },
      },
      select: { id: true, title: true, scope: true, owningGroupId: true, startsAt: true, owningGroup: { select: { name: true } } },
      take: 12,
    }),
  ]);

  const myGroupIds = me
    ? new Set(
        (
          await db.membership.findMany({ where: { userId: me.id }, select: { groupId: true } })
        ).map((m) => m.groupId),
      )
    : new Set<string>();

  const visibleUsers = users.filter((u) => u.searchable || u.memberships.some((m) => myGroupIds.has(m.groupId)));
  const visibleEvents = await filterVisibleEvents(me?.id ?? null, eventCandidates);

  const results: Hit[] = [
    ...groups.map((g) => ({ kind: "group" as const, id: g.id, title: g.name, sub: `${g._count.memberships} member${g._count.memberships === 1 ? "" : "s"}`, href: `/g/${g.slug}` })),
    ...visibleUsers.slice(0, 6).map((u) => ({ kind: "user" as const, id: u.id, title: u.displayName, href: `/u/${u.id}` })),
    ...visibleEvents.slice(0, 6).map((e) => ({ kind: "event" as const, id: e.id, title: e.title, sub: `${e.owningGroup.name} · ${e.startsAt.toLocaleDateString()}`, href: `/e/${e.id}` })),
  ];

  return NextResponse.json({ results });
}
