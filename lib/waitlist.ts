// PRD §9.5 — waitlist promotion. All capacity reads + writes happen inside
// a row lock on the Event so we never overcommit under concurrent RSVPs.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withRowLock } from "@/lib/tx";
import { dispatch } from "@/lib/notifications";
import { renderGenericEmail } from "@/lib/email/templates/generic";

type Tx = Prisma.TransactionClient;

async function goingCountTx(tx: Tx, eventId: string): Promise<number> {
  const rows = await tx.rSVP.findMany({
    where: { eventId, status: "GOING" },
    select: { plusOneCount: true },
  });
  return rows.reduce((acc, r) => acc + 1 + r.plusOneCount, 0);
}

export async function goingCount(eventId: string): Promise<number> {
  return goingCountTx(db as unknown as Tx, eventId);
}

export async function nextWaitlistPosition(eventId: string): Promise<number> {
  const max = await db.rSVP.aggregate({
    where: { eventId, status: "WAITLIST" },
    _max: { waitlistPosition: true },
  });
  return (max._max.waitlistPosition ?? 0) + 1;
}

/**
 * Decide status for a new GOING RSVP. Must be called inside the same row lock
 * that writes the RSVP — otherwise two callers can both observe "fits" and
 * both insert GOING. The caller is responsible for the lock.
 */
export async function statusForNewGoingLocked(
  tx: Tx,
  eventId: string,
  plusOnes: number,
): Promise<"GOING" | "WAITLIST"> {
  const event = await tx.event.findUnique({ where: { id: eventId }, select: { capacity: true } });
  if (!event?.capacity) return "GOING";
  const going = await goingCountTx(tx, eventId);
  return going + 1 + plusOnes > event.capacity ? "WAITLIST" : "GOING";
}

/**
 * Promote as many waitlisters as fit into freed capacity. Locks the Event
 * row for the whole operation. Emits notifications for each promoted user.
 */
export async function maybePromoteFromWaitlist(eventId: string): Promise<void> {
  const promoted: { userId: string; title: string }[] = [];

  await withRowLock("Event", eventId, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, capacity: true },
    });
    if (!event || !event.capacity) return;

    let going = await goingCountTx(tx, eventId);
    if (going >= event.capacity) return;

    const waitlist = await tx.rSVP.findMany({
      where: { eventId, status: "WAITLIST" },
      orderBy: { waitlistPosition: "asc" },
    });

    for (const wl of waitlist) {
      const newCount = going + 1 + wl.plusOneCount;
      if (newCount > event.capacity) break;
      await tx.rSVP.update({
        where: { id: wl.id },
        data: { status: "GOING", waitlistPosition: null },
      });
      going = newCount;
      promoted.push({ userId: wl.userId, title: event.title });
    }
  });

  // Fan out notifications outside the lock to keep it short.
  for (const p of promoted) {
    await dispatch({
      userId: p.userId,
      category: "WAITLIST_PROMOTED",
      title: `You're off the waitlist for ${p.title}`,
      body: "A spot opened up. You're now confirmed as GOING.",
      link: `/e/${eventId}`,
      email: await renderGenericEmail({
        heading: `You're off the waitlist for ${p.title}`,
        body: "A spot opened up and you've been confirmed as GOING.",
        cta: { label: "View event", url: `${process.env.AUTH_URL ?? ""}/e/${eventId}` },
      }),
    });
  }
}
