import { requireVerifiedEmailOrRedirect } from "@/lib/auth-helpers";
import { PasteToEvent } from "@/components/events/paste-to-event";
import { loadOwnableGroups } from "@/lib/ownable-groups";

export default async function FromTextPage() {
  const me = await requireVerifiedEmailOrRedirect("create-event");
  const groups = await loadOwnableGroups(me.id);
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Paste to event</h1>
      <PasteToEvent ownableGroups={groups} />
    </section>
  );
}
