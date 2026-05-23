import { requireUser } from "@/lib/auth-helpers";
import { ImageToEvent } from "@/components/events/image-to-event";
import { loadOwnableGroups } from "@/lib/ownable-groups";

export default async function FromImagePage() {
  const me = await requireUser();
  const groups = await loadOwnableGroups(me.id);
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Flyer to event</h1>
      <ImageToEvent ownableGroups={groups} />
    </section>
  );
}
