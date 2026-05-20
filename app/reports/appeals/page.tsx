import Link from "next/link";
import { requireUser, adminGroupIds } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export default async function AppealsListPage() {
  const me = await requireUser();
  const adminGroups = await adminGroupIds(me.id);

  const [mine, queue] = await Promise.all([
    db.appeal.findMany({ where: { affectedUserId: me.id }, orderBy: { createdAt: "desc" } }),
    adminGroups.length === 0
      ? Promise.resolve([])
      : db.appeal.findMany({
          where: {
            NOT: { affectedUserId: me.id },
            resolvedAt: null,
            user: { memberships: { some: { groupId: { in: adminGroups } } } },
          },
          include: { user: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: "desc" },
        }),
  ]);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Appeals</h1>

      <div>
        <h2 className="text-lg font-semibold">Filed by you</h2>
        <ul className="mt-2 divide-y rounded-md border">
          {mine.length === 0 && <li className="p-3 text-sm text-muted-foreground">No appeals.</li>}
          {mine.map((a) => (
            <li key={a.id} className="p-3 text-sm">
              <Link href={`/reports/appeals/${a.id}`} className="hover:underline font-medium">{a.originalAction}</Link>
              <span className="ml-2 text-xs text-muted-foreground">
                {a.resolvedAt ? "resolved" : "pending"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {adminGroups.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold">Pending review</h2>
          <ul className="mt-2 divide-y rounded-md border">
            {queue.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nothing to review.</li>}
            {queue.map((a) => (
              <li key={a.id} className="p-3 text-sm">
                <Link href={`/reports/appeals/${a.id}`} className="hover:underline">
                  {a.originalAction} — {(a as { user: { displayName: string } }).user.displayName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
