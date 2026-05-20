import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { generateAnnouncements } from "@/lib/llm/announcements";
import { LLMRateLimitError } from "@/lib/anthropic";

export async function POST(req: Request) {
  const user = await requireUser();
  const { eventId } = await req.json();
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { owningGroup: { select: { name: true } }, location: { select: { address: true, venueName: true } } },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Admin of owning or co-host
  const coHosts = await db.eventCoHost.findMany({ where: { eventId }, select: { groupId: true } });
  const groupIds = [event.owningGroupId, ...coHosts.map((c) => c.groupId)];
  const adminMembership = await db.membership.findFirst({
    where: { userId: user.id, role: "ADMIN", groupId: { in: groupIds } },
  });
  if (!adminMembership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const bundle = await generateAnnouncements(user.id, {
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      locationText: event.location ? `${event.location.venueName ?? ""} ${event.location.address}`.trim() : null,
      cost: event.cost,
      groupName: event.owningGroup.name,
      accessibilityFlags: event.accessibilityFlags,
    });
    return NextResponse.json({ bundle });
  } catch (e) {
    if (e instanceof LLMRateLimitError) {
      return NextResponse.json({ error: "rate_limit", resetAt: e.resetAt }, { status: 429 });
    }
    throw e;
  }
}
