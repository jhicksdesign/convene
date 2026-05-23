// iCal feed generator. One function per feed type — user, group, public.
import ical from "ical-generator";
import { db } from "@/lib/db";
import { expandAll } from "@/lib/recurrence";
import { canSeeEvent } from "@/lib/visibility";
import { addDays, addMonths, subDays } from "date-fns";

const CANCELLED_HIDE_DAYS = 30; // §6.2

const HORIZON_MONTHS = 6;

interface Eventish {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  scope: "PUBLIC" | "MEMBERS" | "VOUCHED" | "INVITE";
  owningGroupId: string;
  rrule: string | null;
  recurrenceExceptions: Date[];
  cancelledAt: Date | null;
  location?: { address: string; venueName: string | null } | null;
}

function toCal(name: string, events: Eventish[]) {
  const cal = ical({ name, timezone: "America/Denver" });
  const from = new Date();
  const to = addMonths(from, HORIZON_MONTHS);
  const instances = expandAll(events, from, to);
  for (const inst of instances) {
    const ev = events.find((e) => e.id === inst.parentId)!;
    cal.createEvent({
      id: `${ev.id}-${inst.startsAt.toISOString()}`,
      start: inst.startsAt,
      end: inst.endsAt,
      summary: ev.title + (ev.cancelledAt ? " (Cancelled)" : ""),
      description: ev.description ?? undefined,
      location: ev.location ? `${ev.location.venueName ?? ""} ${ev.location.address}`.trim() : undefined,
      url: `${process.env.AUTH_URL ?? ""}/e/${ev.id}`,
    });
  }
  return cal.toString();
}

export async function publicFeed(): Promise<string> {
  const events = await db.event.findMany({
    where: { scope: "PUBLIC", cancelledAt: null, endsAt: { gte: addDays(new Date(), -1) } },
    include: { location: { select: { address: true, venueName: true } } },
  });
  return toCal("Eventide — Public events", events as Eventish[]);
}

export async function groupFeed(slug: string): Promise<string | null> {
  const group = await db.group.findUnique({
    where: { slug },
    select: { id: true, name: true, visibility: true },
  });
  if (!group) return null;
  if (group.visibility === "INVITE_ONLY") return null;
  const events = await db.event.findMany({
    where: {
      AND: [
        { OR: [{ owningGroupId: group.id }, { coHosts: { some: { groupId: group.id } } }] },
        {
          OR: [
            { cancelledAt: null },
            { cancelledAt: { gt: subDays(new Date(), CANCELLED_HIDE_DAYS) } },
          ],
        },
      ],
      scope: { in: ["PUBLIC", "MEMBERS"] },
      endsAt: { gte: addDays(new Date(), -1) },
    },
    include: { location: { select: { address: true, venueName: true } } },
  });
  return toCal(`Eventide — ${group.name}`, events as Eventish[]);
}

export async function userFeed(token: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { iCalToken: token },
    select: { id: true, displayName: true },
  });
  if (!user) return null;
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);
  const candidates = await db.event.findMany({
    where: {
      AND: [
        { OR: [{ owningGroupId: { in: groupIds } }, { coHosts: { some: { groupId: { in: groupIds } } } }] },
        {
          OR: [
            { cancelledAt: null },
            { cancelledAt: { gt: subDays(new Date(), CANCELLED_HIDE_DAYS) } },
          ],
        },
      ],
      endsAt: { gte: addDays(new Date(), -1) },
    },
    include: { location: { select: { address: true, venueName: true } } },
  });
  const visible: Eventish[] = [];
  for (const e of candidates) {
    if (await canSeeEvent(user.id, e)) visible.push(e as Eventish);
  }
  return toCal(`Eventide — ${user.displayName}`, visible);
}
