import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ExternalCalendars } from "@/components/settings/external-calendars";

export default async function CalendarImportPage() {
  const me = await requireUser();
  const cals = await db.externalCalendar.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { events: true } } },
  });

  const rows = cals.map((c) => ({
    id: c.id,
    label: c.label,
    source: c.source,
    url: c.url,
    color: c.color,
    enabled: c.enabled,
    lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
    lastError: c.lastError,
    eventCount: c._count.events,
  }));

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/settings" className="text-muted-foreground hover:underline">Profile</Link>
        <Link href="/settings/calendar-feeds" className="text-muted-foreground hover:underline">Calendar feeds</Link>
        <Link href="/settings/calendar-import" className="font-medium underline">Import calendar</Link>
        <Link href="/settings/notifications" className="text-muted-foreground hover:underline">Notifications</Link>
      </nav>

      <div className="space-y-2">
        <h1 className="font-display text-2xl font-medium tracking-tight">Import your calendar</h1>
        <p className="text-sm text-muted-foreground">
          Bring your existing Google or Apple calendar into Convene so it can warn you when an event clashes
          with something you&apos;re already doing. We store only event titles and times — never attendees,
          notes, or locations.
        </p>
      </div>

      <ExternalCalendars initial={rows} />
    </section>
  );
}
