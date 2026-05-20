import { requireUser } from "@/lib/auth-helpers";
import { GroupForm } from "@/components/groups/group-form";

export default async function NewGroupPage() {
  await requireUser();
  return (
    <section className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">New group</h1>
      <GroupForm />
    </section>
  );
}
