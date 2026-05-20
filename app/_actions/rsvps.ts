"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { canSeeEvent } from "@/lib/visibility";
import { rsvpInput } from "@/lib/schemas";
import { withRowLock } from "@/lib/tx";
import { maybePromoteFromWaitlist, nextWaitlistPosition, statusForNewGoingLocked } from "@/lib/waitlist";
import { evaluateConditionals } from "@/lib/conditional-rsvps";
import { rateLimit } from "@/lib/rate-limit";
import { bump } from "@/lib/realtime";

export async function setRSVP(input: unknown) {
  const data = rsvpInput.parse(input);
  const user = await requireUser();

  const event = await db.event.findUnique({
    where: { id: data.eventId },
    select: { id: true, scope: true, owningGroupId: true, allowPlusOnes: true, capacity: true },
  });
  if (!event) throw new Error("Event not found");
  if (!(await canSeeEvent(user.id, event))) throw new Error("Forbidden");

  // Anti-spam: cap RSVP flips per user-event so a user can't churn the waitlist.
  await rateLimit(`rsvp:${user.id}:${event.id}`, 10, 60 * 60 * 1000, "Too many RSVP changes — try again in an hour.");

  const plusOnes = event.allowPlusOnes ? data.plusOneCount : 0;

  let prior: { status: string } | null = null;
  let finalStatus: typeof data.status = data.status;
  let waitlistPosition: number | null = null;

  await withRowLock("Event", event.id, async (tx) => {
    prior = await tx.rSVP.findUnique({
      where: { userId_eventId: { userId: user.id, eventId: event.id } },
      select: { status: true },
    });

    if (data.status === "GOING") {
      finalStatus = await statusForNewGoingLocked(tx, event.id, plusOnes);
      if (finalStatus === "WAITLIST") {
        const max = await tx.rSVP.aggregate({
          where: { eventId: event.id, status: "WAITLIST" },
          _max: { waitlistPosition: true },
        });
        waitlistPosition = (max._max.waitlistPosition ?? 0) + 1;
      }
    }

    await tx.rSVP.upsert({
      where: { userId_eventId: { userId: user.id, eventId: event.id } },
      create: {
        userId: user.id,
        eventId: event.id,
        status: finalStatus,
        conditionalMinAttendees: data.conditionalMinAttendees ?? null,
        conditionalOnUserId: data.conditionalOnUserId ?? null,
        plusOneCount: plusOnes,
        waitlistPosition,
      },
      update: {
        status: finalStatus,
        conditionalMinAttendees: data.conditionalMinAttendees ?? null,
        conditionalOnUserId: data.conditionalOnUserId ?? null,
        plusOneCount: plusOnes,
        waitlistPosition,
      },
    });
  });

  // Outside the lock: promotions / conditional evaluation / realtime bump.
  if (prior && (prior as { status: string }).status === "GOING" && finalStatus !== "GOING") {
    await maybePromoteFromWaitlist(event.id);
  }
  await evaluateConditionals(event.id);
  await bump(`event:${event.id}`);
  await bump(`group:${event.owningGroupId}`);

  revalidatePath(`/e/${event.id}`);
  return { status: finalStatus, waitlistPosition };
}

export async function withdrawRSVP(eventId: string) {
  const user = await requireUser();
  await rateLimit(`rsvp:${user.id}:${eventId}`, 10, 60 * 60 * 1000, "Too many RSVP changes — try again in an hour.");

  let priorStatus: string | null = null;
  let owningGroupId: string | null = null;

  await withRowLock("Event", eventId, async (tx) => {
    const prior = await tx.rSVP.findUnique({
      where: { userId_eventId: { userId: user.id, eventId } },
    });
    if (!prior) return;
    priorStatus = prior.status;
    const ev = await tx.event.findUnique({ where: { id: eventId }, select: { owningGroupId: true } });
    owningGroupId = ev?.owningGroupId ?? null;
    await tx.rSVP.delete({ where: { id: prior.id } });
  });

  if (priorStatus === "GOING") await maybePromoteFromWaitlist(eventId);
  await evaluateConditionals(eventId);
  await bump(`event:${eventId}`);
  if (owningGroupId) await bump(`group:${owningGroupId}`);
  revalidatePath(`/e/${eventId}`);
}
