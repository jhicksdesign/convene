import Link from "next/link";
import { requireUser, adminGroupIds } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { EventFormWithAssistant } from "@/components/events/event-form-with-assistant";
import { Button } from "@/components/ui/button";

export default async function NewEventPage() {
  const me = await requireUser();
  const ids = await adminGroupIds(me.id);
  const groups = await db.group.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });

  if (groups.length === 0) {
    return (
      <section className="mx-auto max-w-xl text-center">
        <p>You need to be an admin of a group to create events.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">New event</h1>
        <div className="flex gap-2">
          <Link href="/e/new/from-text"><Button variant="outline" size="sm">From text</Button></Link>
          <Link href="/e/new/from-image"><Button variant="outline" size="sm">From flyer</Button></Link>
        </div>
      </div>
      <EventFormWithAssistant ownableGroups={groups} />
    </section>
  );
}
