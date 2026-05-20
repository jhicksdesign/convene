// PRD §11.2 — heuristic recommender. Used by the For You feed.
// Scoring rules:
//   +3 from a group the user is in
//   +2 per friend GOING
//   +1 per friend INTERESTED
//   +1 if event tag matches a tag from a past GOING RSVP
//   +1 if location within 30 miles of saved home location
import { db } from "@/lib/db";
import { canSeeEvent } from "@/lib/visibility";
import { addDays } from "date-fns";

interface Scored {
  eventId: string;
  score: number;
  reasons: string[];
}

const MILES_30_M = 48_280;

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function recommendFor(userId: string, limit = 5): Promise<Scored[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { homeLat: true, homeLng: true },
  });

  const [memberships, friends, pastGoing] = await Promise.all([
    db.membership.findMany({ where: { userId }, select: { groupId: true } }),
    db.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: { userAId: true, userBId: true },
    }),
    db.rSVP.findMany({
      where: { userId, status: "GOING", event: { startsAt: { lt: new Date() } } },
      select: { event: { select: { tags: true } } },
      take: 50,
    }),
  ]);

  const groupIds = new Set(memberships.map((m) => m.groupId));
  const friendIds = friends.map((f) => (f.userAId === userId ? f.userBId : f.userAId));
  const myTags = new Set(pastGoing.flatMap((r) => r.event.tags));

  const candidates = await db.event.findMany({
    where: {
      startsAt: { gte: new Date(), lte: addDays(new Date(), 30) },
      status: "CONFIRMED",
      cancelledAt: null,
    },
    select: {
      id: true,
      tags: true,
      owningGroupId: true,
      scope: true,
      location: { select: { lat: true, lng: true } },
      rsvps: {
        where: { userId: { in: friendIds }, status: { in: ["GOING", "INTERESTED"] } },
        select: { userId: true, status: true },
      },
      coHosts: { select: { groupId: true } },
    },
    take: 200,
  });

  const scored: Scored[] = [];
  for (const ev of candidates) {
    if (!(await canSeeEvent(userId, ev))) continue;
    let score = 0;
    const reasons: string[] = [];

    const inGroup = groupIds.has(ev.owningGroupId) || ev.coHosts.some((c) => groupIds.has(c.groupId));
    if (inGroup) {
      score += 3;
      reasons.push("from your group");
    }

    const friendsGoing = ev.rsvps.filter((r) => r.status === "GOING").length;
    const friendsInterested = ev.rsvps.filter((r) => r.status === "INTERESTED").length;
    if (friendsGoing) {
      score += 2 * friendsGoing;
      reasons.push(`${friendsGoing} friend${friendsGoing > 1 ? "s" : ""} going`);
    }
    if (friendsInterested) {
      score += friendsInterested;
      reasons.push(`${friendsInterested} interested`);
    }

    if (ev.tags.some((t) => myTags.has(t))) {
      score += 1;
      reasons.push("matches your interests");
    }

    if (user?.homeLat != null && user?.homeLng != null && ev.location) {
      const d = haversineMeters({ lat: user.homeLat, lng: user.homeLng }, ev.location);
      if (d <= MILES_30_M) {
        score += 1;
        reasons.push("near you");
      }
    }

    if (score > 0) scored.push({ eventId: ev.id, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
