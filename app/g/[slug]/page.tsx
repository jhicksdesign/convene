import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, isAdminOf } from "@/lib/auth-helpers";
import { JoinButton } from "@/components/groups/join-button";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { RealtimeSubscribe } from "@/components/realtime/subscribe";
import { EmptyState } from "@/components/common/empty-state";
import { pickTextColor } from "@/lib/color";

export default async function GroupDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = await db.group.findUnique({
    where: { slug },
    select: {
      id: true, name: true, slug: true, color: true, description: true,
      logoUrl: true, visibility: true, joinMode: true,
    },
  });
  if (!group) notFound();

  const me = await getCurrentUser();
  const membership = me ? await db.membership.findUnique({ where: { userId_groupId: { userId: me.id, groupId: group.id } } }) : null;
  const pending = me ? await db.joinRequest.findUnique({ where: { groupId_userId: { groupId: group.id, userId: me.id } } }) : null;
  const memberState: "none" | "pending" | "member" = membership ? "member" : pending?.status === "PENDING" ? "pending" : "none";
  const isAdmin = me ? await isAdminOf(me.id, group.id) : false;

  const upcoming = await db.event.findMany({
    where: {
      OR: [{ owningGroupId: group.id }, { coHosts: { some: { groupId: group.id } } }],
      cancelledAt: null,
      endsAt: { gte: new Date() },
    },
    select: { id: true, title: true, startsAt: true, status: true },
    orderBy: { startsAt: "asc" },
    take: 20,
  });

  const overlayText = pickTextColor(group.color);

  return (
    <section className="space-y-6">
      <RealtimeSubscribe channels={[`group:${group.id}`]} />

      {/* Colored band — the group identity reads instantly. Bleeds to the
          content edges via negative margin to undo the main padding. */}
      <header
        className="relative -mx-4 -mt-6 overflow-hidden md:rounded-b-2xl"
        style={{ backgroundColor: group.color }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.18) 100%)" }}
        />
        <div className="relative flex min-h-36 items-end justify-between gap-4 px-4 pb-5 pt-10 sm:min-h-44 sm:px-6 sm:pb-6 sm:pt-14">
          <div className="max-w-2xl">
            <h1
              className="font-display text-4xl font-medium leading-none tracking-tight sm:text-5xl"
              style={{ color: overlayText, fontVariationSettings: '"opsz" 120, "SOFT" 30' }}
            >
              {group.name}
            </h1>
            {group.description && (
              <p
                className="mt-2 max-w-xl text-sm leading-relaxed sm:text-base"
                style={{ color: overlayText, opacity: 0.92 }}
              >
                {group.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {me && <JoinButton groupId={group.id} initialState={memberState} />}
            {isAdmin && <Link href={`/g/${group.slug}/admin`}><Button variant="outline">Admin</Button></Link>}
          </div>
        </div>
      </header>

      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight">Upcoming events</h2>
        {upcoming.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={Calendar}
              title="Nothing on the calendar yet"
              description={isAdmin ? "Create the first event for this group." : "Check back soon — admins haven't scheduled anything."}
              cta={isAdmin ? { label: "Create an event", href: "/e/new" } : undefined}
            />
          </div>
        ) : (
          <ul
            className="mt-3 overflow-hidden rounded-xl border bg-card"
            style={{ boxShadow: "var(--shadow-paper)" }}
          >
            {upcoming.map((e, i) => (
              <li
                key={e.id}
                className={`relative ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: group.color }}
                />
                <Link
                  href={`/e/${e.id}`}
                  className="flex items-center gap-3 py-3 pl-5 pr-3 text-sm transition-colors hover:bg-accent/40"
                >
                  <span className="w-36 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {format(e.startsAt, "EEE MMM d")}
                    <span className="ml-1 text-foreground/80">{format(e.startsAt, "p")}</span>
                  </span>
                  <span className="truncate font-medium">{e.title}</span>
                  {e.status === "TENTATIVE" && (
                    <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                      tentative
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
