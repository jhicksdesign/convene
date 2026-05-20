import { notFound, forbidden } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, isAdminOf } from "@/lib/auth-helpers";
import { EventForm } from "@/components/events/event-form";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const event = await db.event.findUnique({
    where: { id },
    include: { coHosts: { select: { groupId: true } } },
  });
  if (!event) notFound();

  const groupIds = [event.owningGroupId, ...event.coHosts.map((c) => c.groupId)];
  const isAdmin = (await Promise.all(groupIds.map((g) => isAdminOf(me.id, g)))).some(Boolean);
  if (!isAdmin) forbidden();

  const ownableGroups = await db.group.findMany({
    where: { memberships: { some: { userId: me.id, role: "ADMIN" } } },
    select: { id: true, name: true },
  });

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Edit event</h1>
      <EventForm
        ownableGroups={ownableGroups}
        initial={{
          id: event.id,
          title: event.title,
          description: event.description ?? undefined,
          owningGroupId: event.owningGroupId,
          startsAt: event.startsAt.toISOString().slice(0, 16),
          endsAt: event.endsAt.toISOString().slice(0, 16),
          capacity: event.capacity ?? null,
          cost: event.cost ?? null,
          scope: event.scope,
          status: event.status,
          tags: event.tags,
          accessibilityFlags: event.accessibilityFlags,
          rrule: event.rrule ?? null,
          allowPlusOnes: event.allowPlusOnes,
        }}
      />
    </section>
  );
}
