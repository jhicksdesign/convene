import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export default async function VouchesPage() {
  const me = await requireUser();

  // §8.2 — vouchee sees a count per group, not who vouched.
  const grouped = await db.vouch.groupBy({
    by: ["groupId"],
    where: { voucheeId: me.id, revokedAt: null },
    _count: { _all: true },
  });

  const groups = await db.group.findMany({
    where: { id: { in: grouped.map((g) => g.groupId) } },
    select: { id: true, name: true, color: true, vouchRequirement: true },
  });
  const byId = new Map(groups.map((g) => [g.id, g]));

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Vouches you've received</h1>
      <p className="text-sm text-muted-foreground">
        Counts are private to you. We never show you who vouched.
      </p>
      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">No vouches yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {grouped.map((g) => {
            const meta = byId.get(g.groupId);
            if (!meta) return null;
            const req = meta.vouchRequirement;
            const meets = req === 0 || g._count._all >= req;
            return (
              <li key={g.groupId} className="flex items-center justify-between p-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  {meta.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {g._count._all} vouch{g._count._all === 1 ? "" : "es"}
                  {req > 0 && ` · requirement ${req} ${meets ? "✓" : "✗"}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
