import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ReportForm } from "@/components/safety/report-form";

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; event?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  // Look up display info for any preselected subject/event so the comboboxes
  // show them in their pretty form (not raw IDs).
  const [subject, event] = await Promise.all([
    sp.subject
      ? db.user.findUnique({
          where: { id: sp.subject },
          select: { id: true, displayName: true, avatarUrl: true },
        })
      : Promise.resolve(null),
    sp.event
      ? db.event.findUnique({
          where: { id: sp.event },
          select: {
            id: true,
            title: true,
            startsAt: true,
            owningGroup: { select: { name: true, color: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">File a report</h1>
      <p className="text-sm text-muted-foreground">
        Reports go to admins of the involved group(s). You can include evidence and choose whether the subject sees the report.
      </p>
      <ReportForm
        initialSubject={subject}
        initialEvent={
          event
            ? {
                id: event.id,
                title: event.title,
                groupName: event.owningGroup.name,
                color: event.owningGroup.color,
                startsAt: event.startsAt.toISOString(),
              }
            : null
        }
      />
    </section>
  );
}
