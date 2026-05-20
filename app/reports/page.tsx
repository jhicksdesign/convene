import Link from "next/link";
import { requireUser, adminGroupIds } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";

export default async function ReportsCenterPage() {
  const me = await requireUser();
  const adminGroups = await adminGroupIds(me.id);
  const [mine, queue] = await Promise.all([
    db.incidentReport.findMany({
      where: { reporterId: me.id },
      orderBy: { createdAt: "desc" },
    }),
    db.incidentReport.findMany({
      where: {
        OR: [
          { event: { owningGroupId: { in: adminGroups } } },
          { AND: [{ shareWithSafetyNetwork: true }, { subject: { memberships: { some: { groupId: { in: adminGroups } } } } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <Link href="/reports/new"><Button>New report</Button></Link>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Filed by you</h2>
        <ul className="mt-2 divide-y rounded-md border">
          {mine.length === 0 && <li className="p-3 text-sm text-muted-foreground">None.</li>}
          {mine.map((r) => (
            <li key={r.id} className="p-3 text-sm">
              <Link href={`/reports/${r.id}`} className="hover:underline">{r.body.slice(0, 80)}…</Link>
              <span className="ml-2 text-xs text-muted-foreground">{r.status}</span>
            </li>
          ))}
        </ul>
      </div>
      {adminGroups.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold">Admin queue</h2>
          <ul className="mt-2 divide-y rounded-md border">
            {queue.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nothing to triage.</li>}
            {queue.map((r) => (
              <li key={r.id} className="p-3 text-sm">
                <Link href={`/reports/${r.id}`} className="hover:underline">{r.body.slice(0, 80)}…</Link>
                <span className="ml-2 text-xs text-muted-foreground">{r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
