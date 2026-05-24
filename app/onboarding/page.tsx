import Link from "next/link";
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
