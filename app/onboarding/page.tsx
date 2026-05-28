import Link from "next/link";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { hasRealEmail } from "@/lib/identity";
import { ProfileForm } from "@/components/settings/profile-form";
import { GroupCard } from "@/components/groups/group-card";

export default async function OnboardingPage() {
  const user = await requireUser();
  const me = await db.user.findUnique({
    where: { id: user.id },
    select: {
      email: true, emailVerified: true,
      displayName: true, pronouns: true, bio: true, avatarUrl: true,
      timezone: true, homeLat: true, homeLng: true,
    },
  });
  if (!me) return null;
  const needsEmail = !hasRealEmail(me);

  // Upcoming PUBLIC events from PUBLIC_LISTED groups — what a new user could
  // RSVP to right now without joining anything first.
  const upcoming = await db.event.findMany({
    where: {
      scope: "PUBLIC",
      cancelledAt: null,
      startsAt: { gte: new Date() },
      owningGroup: { visibility: "PUBLIC_LISTED" },
    },
    select: {
      id: true, title: true, startsAt: true, flyerImageUrl: true,
      owningGroup: { select: { name: true, color: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 6,
  });

  const groups = await db.group.findMany({
    where: { visibility: { in: ["PUBLIC_LISTED", "MEMBERS_VISIBLE"] } },
    select: { id: true, name: true, slug: true, color: true, description: true, _count: { select: { memberships: true } } },
    take: 24,
  });

  return (
    <section className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
        {needsEmail && (
          <Link
            href="/settings/email"
            className="mt-3 block rounded-lg border bg-card p-3 text-sm hover:bg-muted/40"
          >
            <span className="font-medium">Add an email</span>
            <span className="text-muted-foreground"> — needed to create events or join private groups.</span>
          </Link>
        )}
        <div className="mt-4 max-w-xl">
          <ProfileForm initial={me} />
        </div>
      </div>

      {upcoming.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Happening soon</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {upcoming.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/e/${e.id}`}
                  className="group flex gap-3 overflow-hidden rounded-lg border bg-card transition-colors hover:bg-accent/40"
                >
                  {e.flyerImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.flyerImageUrl} alt="" className="h-20 w-24 shrink-0 object-cover" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-20 w-24 shrink-0"
                      style={{ backgroundColor: e.owningGroup.color }}
                    />
                  )}
                  <div className="min-w-0 flex-1 py-2 pr-3">
                    <p className="truncate font-medium leading-tight">{e.title}</p>
                    <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {format(e.startsAt, "EEE MMM d · p")}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{e.owningGroup.name}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold tracking-tight">Browse groups</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              slug={g.slug}
              name={g.name}
              color={g.color}
              description={g.description}
              memberCount={g._count.memberships}
            />
          ))}
        </div>
        <Link href="/calendar" className="mt-6 inline-block text-sm underline">Skip and go to the calendar →</Link>
      </div>
    </section>
  );
}
