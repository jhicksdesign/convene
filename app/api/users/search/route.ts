import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { blockedUserIds } from "@/lib/visibility";

// Used by friend-add and conditional-RSVP pickers.
// Returns users the searcher is allowed to interact with: shares-a-group OR
// is searchable=true. Excludes blocked / soft-deleted accounts.
export async function GET(req: Request) {
  const me = await requireUser();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const blocked = await blockedUserIds(me.id);

  const candidates = await db.user.findMany({
    where: {
      deletedAt: null,
      id: { not: me.id, notIn: Array.from(blocked) },
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { searchable: true, email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, displayName: true, avatarUrl: true, searchable: true, memberships: { select: { groupId: true } } },
    take: 20,
  });

  const myMemberships = await db.membership.findMany({
    where: { userId: me.id },
    select: { groupId: true },
  });
  const myGroupSet = new Set(myMemberships.map((m) => m.groupId));

  const results = candidates
    .filter((u) => u.searchable || u.memberships.some((m) => myGroupSet.has(m.groupId)))
    .map((u) => ({ id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl }));

  return NextResponse.json({ results });
}
