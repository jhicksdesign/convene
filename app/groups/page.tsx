import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { GroupCard } from "@/components/groups/group-card";
import { Button } from "@/components/ui/button";

export default async function GroupsDirectoryPage() {
  const user = await getCurrentUser();
  const groups = await db.group.findMany({
    where: user
      ? { visibility: { in: ["PUBLIC_LISTED", "MEMBERS_VISIBLE"] } }
      : { visibility: "PUBLIC_LISTED" },
    select: {
      id: true, name: true, slug: true, color: true, description: true,
      _count: { select: { memberships: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
        {user && <Link href="/groups/new"><Button>New group</Button></Link>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    </section>
  );
}
