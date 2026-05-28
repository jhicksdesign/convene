import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser, isAdminOf } from "@/lib/auth-helpers";
import { filterVisibleEvents } from "@/lib/visibility";
import { JoinButton } from "@/components/groups/join-button";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { RealtimeSubscribe } from "@/components/realtime/subscribe";
import { EmptyState } from "@/components/common/empty-state";
import { pickTextColor } from "@/lib/color";
import { ArrowRight } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const group = await db.group.findUnique({
    where: { slug },
    select: { name: true, description: true, visibility: true },
  });
  // Only PUBLIC_LISTED groups leak any identifying info via OG cards.
  // Anything else gets generic metadata so shared URLs don't expose existence.
  if (!group || group.visibility !== "PUBLIC_LISTED") {
    return { title: "Eventide", description: "Community calendar." };
  }
  const desc = group.description?.slice(0, 200) ?? `Upcoming events for ${group.name} on Eventide.`;
  return {
    title: `${group.name} · Eventide`,
    description: desc,
    openGraph: { title: group.name, description: desc, type: "website" },
    twitter: { card: "summary", title: group.name, description: desc },
  };
}

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

  // Visibility gate. INVITE_ONLY groups are invisible to anyone who isn't a
  // member; MEMBERS_VISIBLE groups are invisible to logged-out viewers. We
  // 404 (rather than 403) so the URL doesn't leak that the group exists.
  if (group.visibility === "INVITE_ONLY" && !membership) notFound();
  if (group.visibility === "MEMBERS_VISIBLE" && !me) notFound();

  // Non-members (including unauth) only see PUBLIC-scope events. Members and
  // admins see everything from their group; cross-group MEMBERS/VOUCHED/INVITE
  // events that happen to be co-hosted here are filtered by canSeeEvent below.
  const upcomingRaw = await db.event.findMany({
    where: {
      OR: [{ owningGroupId: group.id }, { coHosts: { some: { groupId: group.id } } }],
      cancelledAt: null,
      endsAt: { gte: new Date() },
      ...(membership ? {} : { scope: "PUBLIC" }),
    },
    select: { id: true, title: true, startsAt: true, status: true, scope: true, owningGroupId: true, flyerImageUrl: true },
    orderBy: { startsAt: "asc" },
    take: 20,
  });
  const upcoming = await filterVisibleEvents(me?.id ?? null, upcomingRaw);

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

      {!me && group.visibility !== "INVITE_ONLY" && (
        <aside
          className="-mt-2 overflow-hidden rounded-xl border-l-4 bg-card"
          style={{ borderLeftColor: group.color, boxShadow: "var(--shadow-paper)" }}
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:p-5">
            <div className="min-w-[14rem] flex-1">
              <h2
                className="font-display text-xl font-medium leading-tight tracking-tight"
                style={{ fontVariationSettings: '"opsz" 36, "SOFT" 50' }}
              >
                Want in?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in to join <span className="font-medium text-foreground">{group.name}</span>, RSVP to its events, and see who’s going.
              </p>
            </div>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(`/g/${group.slug}`)}`}
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: group.color, color: pickTextColor(group.color) }}
            >
              Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </aside>
      )}

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
                  {e.flyerImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.flyerImageUrl}
                      alt=""
                      className="h-10 w-14 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span aria-hidden="true" className="h-10 w-14 shrink-0 rounded bg-muted" />
                  )}
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
