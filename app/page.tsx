import Link from "next/link";
import { ArrowRight, Calendar as CalendarIcon, MapPin, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { GroupCard } from "@/components/groups/group-card";
import { Reveal } from "@/components/common/reveal";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { recommendFor } from "@/lib/recommendations";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    // Anonymous landing — surface the actual public calendar so visitors can
    // see there's life here without having to click "Browse" on faith.
    // PRIVACY: we only render PUBLIC events from PUBLIC_LISTED groups; the
    // visibility model already guarantees this is what an anon viewer could
    // reach by hand from /calendar and /groups.
    const [upcoming, groups] = await Promise.all([
      db.event.findMany({
        where: {
          scope: "PUBLIC",
          cancelledAt: null,
          startsAt: { gte: new Date() },
          owningGroup: { visibility: "PUBLIC_LISTED" },
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          flyerImageUrl: true,
          owningGroup: { select: { name: true, color: true, slug: true } },
        },
        orderBy: { startsAt: "asc" },
        take: 6,
      }),
      db.group.findMany({
        where: { visibility: "PUBLIC_LISTED" },
        select: {
          id: true, name: true, slug: true, color: true, description: true,
          _count: { select: { memberships: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    return (
      <div className="relative space-y-12 sm:space-y-16">
        {/* Atmospheric backdrop — corner-anchored radial gradients on a
            single fixed full-viewport div. Stops are percentages so the
            falloff adapts to any viewport shape; center stays clean. */}
        <div aria-hidden="true" className="hero-atmosphere pointer-events-none fixed inset-0 -z-10" />

        {/* ───────── Hero — compressed but still anchoring ───────── */}
        <Reveal as="section" className="pt-4 text-center sm:pt-8">
          <h1
            className="font-display text-5xl font-medium leading-[0.95] tracking-tight sm:text-6xl"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 25' }}
          >
            Eventide
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            The calendar where overlapping communities see what each other is doing —
            so nobody has to schedule a meeting just to schedule a meet.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Link href="/calendar">
              <Button size="lg" className="gap-1.5">
                Browse the calendar <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/map">
              <Button size="lg" variant="outline" className="gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                See the map
              </Button>
            </Link>
          </div>
        </Reveal>

        {/* ───────── Happening soon ───────── */}
        <section>
          <header className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2
                className="font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
                style={{ fontVariationSettings: '"opsz" 64, "SOFT" 40' }}
              >
                Happening soon
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upcoming events from public communities.
              </p>
            </div>
            <Link
              href="/calendar"
              className="hidden font-mono text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex sm:items-center sm:gap-1"
            >
              See all <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </header>

          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarIcon}
              title="No public events on the schedule"
              description="Public events from open groups appear here. The community is just getting going."
              cta={{ label: "Browse groups", href: "/groups" }}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {upcoming.map((e, i) => (
                <Reveal as="li" key={e.id} delay={0.05 + i * 0.04}>
                  <Link href={`/e/${e.id}`} className="group block h-full">
                    <Card
                      className="relative flex h-full flex-col overflow-hidden border-l-4 p-0 transition-all duration-150 group-hover:-translate-y-px"
                      style={{ borderLeftColor: e.owningGroup.color, boxShadow: "var(--shadow-paper)" }}
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        style={{ background: `linear-gradient(110deg, ${e.owningGroup.color}12, transparent 65%)` }}
                      />
                      {/* Cover region — flyer when present, group-color block otherwise.
                          The colored fallback turns "no image" into a deliberate visual
                          signal rather than a missing-data hole. */}
                      <div
                        className="relative aspect-[5/3] w-full overflow-hidden"
                        style={{ backgroundColor: e.flyerImageUrl ? undefined : `${e.owningGroup.color}` }}
                      >
                        {e.flyerImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.flyerImageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            aria-hidden="true"
                            className="absolute inset-0"
                            style={{
                              background: `linear-gradient(135deg, ${e.owningGroup.color} 0%, ${e.owningGroup.color}cc 60%, ${e.owningGroup.color}99 100%)`,
                            }}
                          />
                        )}
                      </div>
                      <CardHeader className="relative z-10 pb-2 pt-3">
                        <h3
                          className="line-clamp-2 font-display text-lg font-medium leading-tight tracking-tight"
                          style={{ fontVariationSettings: '"opsz" 36, "SOFT" 55' }}
                        >
                          {e.title}
                        </h3>
                        <CardDescription className="font-mono text-xs tabular-nums">
                          {format(e.startsAt, "EEE MMM d")}
                          <span className="ml-1 text-foreground/70">{format(e.startsAt, "p")}</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="relative z-10 mt-auto pb-3 pt-0 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: e.owningGroup.color }}
                          />
                          <span className="truncate">{e.owningGroup.name}</span>
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                </Reveal>
              ))}
            </ul>
          )}
          {upcoming.length > 0 && (
            <div className="mt-4 sm:hidden">
              <Link href="/calendar">
                <Button variant="outline" className="w-full gap-1.5">
                  See all on the calendar <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          )}
        </section>

        {/* ───────── Communities ───────── */}
        {groups.length > 0 && (
          <section>
            <header className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2
                  className="font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
                  style={{ fontVariationSettings: '"opsz" 64, "SOFT" 40' }}
                >
                  Communities
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Groups posting publicly — drop in, see what they do.
                </p>
              </div>
              <Link
                href="/groups"
                className="hidden font-mono text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex sm:items-center sm:gap-1"
              >
                See all <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {groups.map((g, i) => (
                <Reveal key={g.id} delay={0.05 + i * 0.04} className="h-full">
                  <GroupCard
                    slug={g.slug}
                    name={g.name}
                    color={g.color}
                    description={g.description}
                    memberCount={g._count.memberships}
                  />
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ───── Authed: existing "For you" recommendation surface, preserved verbatim
  const recommendations = await recommendFor(user.id, 5);
  const events = await db.event.findMany({
    where: { id: { in: recommendations.map((r) => r.eventId) } },
    include: { owningGroup: { select: { name: true, color: true } } },
  });
  const byId = new Map(events.map((e) => [e.id, e]));

  return (
    <section className="space-y-6">
      <Reveal>
        <h1 className="font-display text-3xl font-medium leading-none tracking-tight sm:text-4xl">
          For you
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Picked for you from your groups and what’s nearby.
        </p>
      </Reveal>
      {recommendations.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing tailored for you yet"
          description="Recommendations get smarter as you join groups and RSVP to events."
          cta={{ label: "Browse groups", href: "/groups" }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recommendations.map((r, i) => {
            const e = byId.get(r.eventId);
            if (!e) return null;
            return (
              <Reveal key={r.eventId} delay={i * 0.04} className="h-full">
              <Link href={`/e/${e.id}`} className="group block h-full">
                <Card
                  className="relative h-full overflow-hidden border-l-4 transition-all duration-150 group-hover:-translate-y-px"
                  style={{ borderLeftColor: e.owningGroup.color }}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    style={{ background: `linear-gradient(110deg, ${e.owningGroup.color}10, transparent 60%)` }}
                  />
                  <CardHeader>
                    <h3
                      className="font-display text-lg font-medium leading-tight tracking-tight"
                      style={{ fontVariationSettings: '"opsz" 36, "SOFT" 60' }}
                    >
                      {e.title}
                    </h3>
                    <CardDescription className="font-mono text-xs tabular-nums">
                      {format(e.startsAt, "EEE MMM d")}
                      <span className="ml-1 text-foreground/70">{format(e.startsAt, "p")}</span>
                      <span className="ml-2 font-sans text-muted-foreground">· {e.owningGroup.name}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    {r.reasons.join(" · ")}
                  </CardContent>
                </Card>
              </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </section>
  );
}
