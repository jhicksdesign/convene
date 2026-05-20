import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, isAdminOf } from "@/lib/auth-helpers";
import { JoinButton } from "@/components/groups/join-button";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { RealtimeSubscribe } from "@/components/realtime/subscribe";

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

  return (
    <section className="space-y-6">
      <RealtimeSubscribe channels={[`group:${group.id}`]} />
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
            <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
          </div>
          {group.description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{group.description}</p>}
        </div>
        <div className="flex gap-2">
          {me && <JoinButton groupId={group.id} initialState={memberState} />}
          {isAdmin && <Link href={`/g/${group.slug}/admin`}><Button variant="outline">Admin</Button></Link>}
        </div>
      </header>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Upcoming events</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing on the calendar yet.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-md border bg-background">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-32 shrink-0 text-xs text-muted-foreground">{format(e.startsAt, "EEE MMM d, p")}</span>
                <Link href={`/e/${e.id}`} className="hover:underline">{e.title}</Link>
                {e.status === "TENTATIVE" && <span className="ml-auto text-xs text-amber-600">tentative</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
