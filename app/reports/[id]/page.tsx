import { notFound, forbidden } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, adminGroupIds } from "@/lib/auth-helpers";
import { transitionReport } from "@/app/_actions/reports";
import { Button } from "@/components/ui/button";

async function transitionAction(formData: FormData) {
  "use server";
  await transitionReport(
    formData.get("id") as string,
    formData.get("next") as "ACKNOWLEDGED" | "INVESTIGATING" | "RESOLVED" | "DISMISSED",
    (formData.get("note") as string) || undefined,
  );
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const r = await db.incidentReport.findUnique({
    where: { id },
    include: { event: true, auditLog: { orderBy: { createdAt: "asc" } } },
  });
  if (!r) notFound();

  const adminGroups = await adminGroupIds(me.id);
  const canTriage = me.id === r.reporterId
    ? false
    : adminGroups.length > 0 && (!r.event || adminGroups.includes(r.event.owningGroupId));

  if (me.id !== r.reporterId && !canTriage) forbidden();

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Report</h1>
      <p className="text-sm">{r.body}</p>
      <p className="text-xs text-muted-foreground">Status: {r.status}</p>

      {canTriage && r.status !== "RESOLVED" && r.status !== "DISMISSED" && (
        <form action={transitionAction} className="space-y-2 rounded-md border bg-muted/40 p-4">
          <input type="hidden" name="id" value={r.id} />
          <select name="next" className="rounded-md border bg-background p-2 text-sm">
            <option value="ACKNOWLEDGED">Acknowledge</option>
            <option value="INVESTIGATING">Mark investigating</option>
            <option value="RESOLVED">Resolve</option>
            <option value="DISMISSED">Dismiss</option>
          </select>
          <textarea name="note" rows={3} placeholder="Resolution note (optional)" className="w-full rounded-md border bg-background p-2 text-sm" />
          <Button type="submit" size="sm">Update status</Button>
        </form>
      )}

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Audit log</h2>
        <ol className="mt-2 space-y-1 text-xs">
          {r.auditLog.map((a) => (
            <li key={a.id}><span className="text-muted-foreground">{a.createdAt.toLocaleString()}</span> — {a.action}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
