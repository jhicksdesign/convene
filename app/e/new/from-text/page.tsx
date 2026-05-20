import { requireUser, adminGroupIds } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PasteToEvent } from "@/components/events/paste-to-event";

export default async function FromTextPage() {
  const me = await requireUser();
  const ids = await adminGroupIds(me.id);
  const groups = await db.group.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Paste to event</h1>
      <PasteToEvent ownableGroups={groups} />
    </section>
  );
}
