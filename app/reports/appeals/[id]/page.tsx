import { notFound, forbidden } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, adminGroupIds } from "@/lib/auth-helpers";
import { respondToAppeal } from "@/app/_actions/appeals";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

async function respondAction(formData: FormData) {
  "use server";
  await respondToAppeal(formData.get("id") as string, formData.get("response") as string);
}

export default async function AppealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const appeal = await db.appeal.findUnique({
    where: { id },
    include: { user: { select: { id: true, displayName: true, memberships: { select: { groupId: true } } } } },
  });
  if (!appeal) notFound();

  const isAffected = appeal.affectedUserId === me.id;
  let canRespond = false;
  if (!isAffected) {
    const adminGroups = await adminGroupIds(me.id);
    const subjectGroups = new Set(appeal.user.memberships.map((m) => m.groupId));
    canRespond = adminGroups.some((g) => subjectGroups.has(g));
  }
  if (!isAffected && !canRespond) forbidden();

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Appeal</h1>
      <div className="rounded-md border bg-muted/30 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Original action</p>
        <p className="text-sm">{appeal.originalAction}</p>
      </div>
      <div className="rounded-md border p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{appeal.user.displayName}'s statement</p>
        <p className="text-sm whitespace-pre-wrap">{appeal.userStatement}</p>
      </div>
      {appeal.adminResponse ? (
        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin response · final</p>
          <p className="text-sm whitespace-pre-wrap">{appeal.adminResponse}</p>
        </div>
      ) : canRespond ? (
        <form action={respondAction} className="space-y-2 rounded-md border bg-muted/30 p-3">
          <input type="hidden" name="id" value={appeal.id} />
          <Textarea name="response" rows={6} required placeholder="Your decision and reasoning. This is final." />
          <Button type="submit">Submit decision</Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Awaiting admin response.</p>
      )}
    </section>
  );
}
