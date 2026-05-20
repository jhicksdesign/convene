import { requireUser, adminGroupIds } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ImageToEvent } from "@/components/events/image-to-event";

export default async function FromImagePage() {
  const me = await requireUser();
  const ids = await adminGroupIds(me.id);
  const groups = await db.group.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Flyer to event</h1>
      <ImageToEvent ownableGroups={groups} />
    </section>
  );
}
