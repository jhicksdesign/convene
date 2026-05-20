import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { unblockUser } from "@/app/_actions/blocks";

async function unblockAction(formData: FormData) {
  "use server";
  await unblockUser(formData.get("id") as string);
}

export default async function BlocksPage() {
  const me = await requireUser();
  const blocks = await db.block.findMany({
    where: { blockerId: me.id },
    include: { blocked: { select: { id: true, displayName: true } } },
  });
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Blocked users</h1>
      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one blocked.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{b.blocked.displayName}</span>
              <form action={unblockAction}>
                <input type="hidden" name="id" value={b.blockedId} />
                <Button size="sm" variant="outline" type="submit">Unblock</Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
