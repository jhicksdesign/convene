import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { EventFormWithAssistant } from "@/components/events/event-form-with-assistant";
import { Button } from "@/components/ui/button";
import type { EventFormInitial } from "@/components/events/event-form";
import { loadOwnableGroups } from "@/lib/ownable-groups";

function toLocalIso(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ dup?: string }>;
}) {
  const me = await requireUser();
  const groups = await loadOwnableGroups(me.id);
  const adminGroupIdSet = new Set(groups.map((g) => g.id));

  if (groups.length === 0) {
    return (
      <section className="mx-auto max-w-xl text-center">
        <p>You need to be an admin of a group to create events.</p>
      </section>
    );
  }

  // Duplicate: prefill from a source event (skip date/time so admin picks fresh).
  const sp = await searchParams;
  let initial: EventFormInitial | undefined;
  if (sp.dup) {
    const src = await db.event.findUnique({
      where: { id: sp.dup },
      include: { coHosts: { select: { groupId: true } } },
    });
    if (src && adminGroupIdSet.has(src.owningGroupId)) {
      // Default the duplicate's start to next week, same weekday + same time-of-day.
      const newStart = new Date(src.startsAt);
      newStart.setDate(newStart.getDate() + 7);
      const newEnd = new Date(newStart.getTime() + (src.endsAt.getTime() - src.startsAt.getTime()));
      initial = {
        title: src.title,
        description: src.description ?? undefined,
        owningGroupId: src.owningGroupId,
        startsAt: toLocalIso(newStart),
        endsAt: toLocalIso(newEnd),
        capacity: src.capacity ?? null,
        cost: src.cost ?? null,
        scope: src.scope,
        status: "CONFIRMED",
        tags: src.tags,
        accessibilityFlags: src.accessibilityFlags,
        rrule: src.rrule ?? null,
        allowPlusOnes: src.allowPlusOnes,
        useWaitlist: src.useWaitlist,
      };
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {initial ? "Duplicate event" : "New event"}
        </h1>
        <div className="flex gap-2">
          <Link href="/e/new/from-text"><Button variant="outline" size="sm">From text</Button></Link>
          <Link href="/e/new/from-image"><Button variant="outline" size="sm">From flyer</Button></Link>
        </div>
      </div>
      {initial && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          We pre-filled the form from the source event and bumped the start date by 1 week. Edit anything before saving.
        </p>
      )}
      <EventFormWithAssistant ownableGroups={groups} initial={initial} />
    </section>
  );
}
