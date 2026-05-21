import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { filterVisibleEvents } from "@/lib/visibility";

export async function GET(req: Request) {
  const me = await getCurrentUser();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();

  const candidates = await db.event.findMany({
    where: q.length >= 2 ? { title: { contains: q, mode: "insensitive" } } : {},
    select: {
      id: true,
      title: true,
      scope: true,
      owningGroupId: true,
      startsAt: true,
      owningGroup: { select: { name: true, color: true } },
    },
    orderBy: { startsAt: "desc" },
    take: 20,
  });

  const visible = await filterVisibleEvents(me?.id ?? null, candidates);
  return NextResponse.json({
    results: visible.slice(0, 12).map((e) => ({
      id: e.id,
      title: e.title,
      groupName: e.owningGroup.name,
      color: e.owningGroup.color,
      startsAt: e.startsAt.toISOString(),
    })),
  });
}
