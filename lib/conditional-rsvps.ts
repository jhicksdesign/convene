// PRD §9.2 — evaluate conditional RSVPs against current state.
// Reads counts inside a row lock on the Event so concurrent setRSVPs don't
// produce inconsistent "promote N" decisions.
import { db } from "@/lib/db";
import { withRowLock } from "@/lib/tx";
import { dispatch } from "@/lib/notifications";
import { renderGenericEmail } from "@/lib/email/templates/generic";

export async function evaluateConditionals(eventId: string): Promise<void> {
  const promotions: { userId: string; title: string }[] = [];

  await withRowLock("Event", eventId, async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId }, select: { id: true, title: true } });
    if (!event) return;

    const conditionals = await tx.rSVP.findMany({ where: { eventId, status: "CONDITIONAL" } });
    if (conditionals.length === 0) return;

    const goingRows = await tx.rSVP.findMany({
      where: { eventId, status: "GOING" },
      select: { plusOneCount: true, userId: true },
    });
    const going = goingRows.reduce((acc, r) => acc + 1 + r.plusOneCount, 0);
    const goingUsers = new Set(goingRows.map((r) => r.userId));

    for (const r of conditionals) {
      let promote = false;
      if (r.conditionalOnUserId) {
        if (goingUsers.has(r.conditionalOnUserId)) promote = true;
      } else if (r.conditionalMinAttendees != null) {
        if (going >= r.conditionalMinAttendees) promote = true;
      }
      if (!promote) continue;

      await tx.rSVP.update({ where: { id: r.id }, data: { status: "GOING" } });
      promotions.push({ userId: r.userId, title: event.title });
    }
  });

  for (const p of promotions) {
    await dispatch({
      userId: p.userId,
      category: "CONDITIONAL_TRIGGERED",
      title: `Your conditional RSVP for ${p.title} converted`,
      body: "Your conditions were met — you're now GOING.",
      link: `/e/${eventId}`,
      email: await renderGenericEmail({
        heading: `You're confirmed for ${p.title}`,
        body: "Your conditional RSVP just converted.",
        cta: { label: "View event", url: `${process.env.AUTH_URL ?? ""}/e/${eventId}` },
      }),
    });
  }
}
