import Link from "next/link";
import { format, startOfWeek, subWeeks, differenceInCalendarWeeks, addDays } from "date-fns";
import { CalendarPlus, Users, Settings, CalendarDays, Sparkles, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { Sparkline } from "@/components/groups/sparkline";
import { Reveal } from "@/components/common/reveal";
import { pickTextColor } from "@/lib/color";

const ACTIVITY_WEEKS = 12;

export default async function MePage() {
  const user = await requireUser();
  const now = new Date();
  const activityStart = startOfWeek(subWeeks(now, ACTIVITY_WEEKS - 1), { weekStartsOn: 0 });

  const [memberships, upcoming, pastGoing] = await Promise.all([
    db.membership.findMany({
      where: { userId: user.id },
      select: { role: true, group: { select: { name: true, slug: true, color: true } } },
      orderBy: { joinedAt: "desc" },
    }),
    // Everything the user has signalled they'll show up to, soonest first.
    db.rSVP.findMany({
      where: {
        userId: user.id,
        status: { in: ["GOING", "INTERESTED", "CONDITIONAL", "WAITLIST"] },
        event: { startsAt: { gte: now }, cancelledAt: null },
      },
      select: {
        status: true,
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            owningGroup: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: { event: { startsAt: "asc" } },
      take: 12,
    }),
    // Past confirmed attendance, for the rhythm sparkline.
    db.rSVP.findMany({
      where: {
        userId: user.id,
        status: "GOING",
        event: { startsAt: { gte: activityStart, lt: now } },
      },
      select: { event: { select: { startsAt: true } } },
    }),
  ]);

  // Bucket past attendance into weekly counts for the sparkline.
  const weekly = new Array(ACTIVITY_WEEKS).fill(0);
  for (const r of pastGoing) {
    const idx = differenceInCalendarWeeks(r.event.startsAt, activityStart, { weekStartsOn: 0 });
    if (idx >= 0 && idx < ACTIVITY_WEEKS) weekly[idx] += 1;
  }
  const hasActivity = pastGoing.length > 0;

  const weekCutoff = addDays(now, 7);
  const thisWeek = upcoming.filter((r) => r.event.startsAt < weekCutoff);
  const later = upcoming.filter((r) => r.event.startsAt >= weekCutoff);

  const firstName = user.displayName?.split(/\s+/)[0] ?? "there";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* ── Greeting + quick actions ── */}
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium leading-none tracking-tight sm:text-4xl">
            Hi, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Here’s your week and the communities you’re part of.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/e/new">
            <Button size="sm" className="gap-1.5">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" /> New event
            </Button>
          </Link>
          <Link href="/groups">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Users className="h-4 w-4" aria-hidden="true" /> Groups
            </Button>
          </Link>
          <Link href="/settings" aria-label="Settings">
            <Button size="sm" variant="ghost" className="gap-1.5">
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </Link>
        </div>
      </Reveal>

      {/* ── Your week ── */}
      <Reveal delay={0.06} className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-medium tracking-tight">Your week</h2>
          <Link
            href="/calendar?mine=1"
            className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Full calendar
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing on your calendar yet"
            description="RSVP to an event and it’ll show up here. Browse what’s happening to get started."
            cta={{ label: "Browse the calendar", href: "/calendar" }}
          />
        ) : (
          <div className="space-y-4">
            {thisWeek.length > 0 && <RsvpList rows={thisWeek} />}
            {later.length > 0 && (
              <div className="space-y-2">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Later</p>
                <RsvpList rows={later} />
              </div>
            )}
          </div>
        )}
      </Reveal>

      {/* ── Communities + rhythm ── */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Reveal delay={0.12} className="space-y-3 lg:col-span-3">
          <h2 className="font-display text-2xl font-medium tracking-tight">Your communities</h2>
          {memberships.length === 0 ? (
            <EmptyState
              icon={Users}
              title="You haven’t joined any groups"
              description="Groups are how events find you. Find one that fits."
              cta={{ label: "Browse groups", href: "/groups" }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {memberships.map((m) => (
                <Link
                  key={m.group.slug}
                  href={`/g/${m.group.slug}`}
                  className="group inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm font-medium shadow-[var(--shadow-paper)] transition-all hover:-translate-y-px"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: m.group.color }}
                  />
                  <span className="truncate">{m.group.name}</span>
                  {m.role === "ADMIN" && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ backgroundColor: m.group.color, color: pickTextColor(m.group.color) }}
                    >
                      admin
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Reveal>

        <Reveal delay={0.16} className="lg:col-span-2">
          <div
            className="h-full rounded-xl border bg-card p-5"
            style={{ boxShadow: "var(--shadow-paper)" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="font-display text-lg font-medium tracking-tight">Your rhythm</h2>
            </div>
            {hasActivity ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-mono font-semibold tabular-nums text-foreground">{pastGoing.length}</span>{" "}
                  event{pastGoing.length === 1 ? "" : "s"} in the last {ACTIVITY_WEEKS} weeks
                </p>
                <div className="mt-3 w-full text-primary">
                  <Sparkline values={weekly} width={320} height={56} />
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Once you start showing up, your attendance over time appears here.
              </p>
            )}
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.2}>
        <Link
          href={`/u/${user.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          View your public profile <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </Reveal>
    </div>
  );
}

/* Compact agenda row list, reused for "this week" and "later". The colored
   rail + monospace date echo the calendar's agenda view so the dashboard
   feels like the same product. */
function RsvpList({
  rows,
}: {
  rows: {
    status: string;
    event: { id: string; title: string; startsAt: Date; owningGroup: { name: string; color: string } };
  }[];
}) {
  return (
    <ul className="overflow-hidden rounded-xl border bg-card" style={{ boxShadow: "var(--shadow-paper)" }}>
      {rows.map((r, i) => (
        <li key={r.event.id} className={`relative ${i > 0 ? "border-t border-border" : ""}`}>
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1"
            style={{ backgroundColor: r.event.owningGroup.color }}
          />
          <Link
            href={`/e/${r.event.id}`}
            className="flex items-center gap-3 py-3 pl-5 pr-3 text-sm transition-colors hover:bg-accent/40"
          >
            <span className="w-28 shrink-0 font-mono text-xs tabular-nums text-muted-foreground sm:w-32">
              {format(r.event.startsAt, "EEE MMM d")}
              <span className="ml-1 text-foreground/80">{format(r.event.startsAt, "p")}</span>
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{r.event.title}</span>
            {r.status !== "GOING" && (
              <span className="ml-auto hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground sm:inline">
                {r.status.toLowerCase()}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
