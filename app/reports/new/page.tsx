import { requireUser } from "@/lib/auth-helpers";
import { ReportForm } from "@/components/safety/report-form";

export default async function NewReportPage({ searchParams }: { searchParams: Promise<{ subject?: string; event?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">File a report</h1>
      <ReportForm initialSubjectId={sp.subject} initialEventId={sp.event} />
    </section>
  );
}
