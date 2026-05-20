import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { SoftClaimForm } from "@/components/events/soft-claim-form";
import { GroupForm } from "@/components/groups/group-form";

export default async function GroupAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = await db.group.findUnique({
    where: { slug },
    select: {
      id: true, name: true, slug: true, color: true, description: true,
      visibility: true, joinMode: true, vouchRequirement: true,
    },
  });
  if (!group) notFound();
  await requireAdmin(group.id);

  const [members, joinRequests, softClaims, recentEvents, claimHistory] = await Promise.all([
    db.membership.findMany({
      where: { groupId: group.id },
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { joinedAt: "desc" },
    }),
    db.joinRequest.findMany({
      where: { groupId: group.id, status: "PENDING" },
    }),
    db.softClaim.findMany({
      where: { groupId: group.id, expiresAt: { gt: new Date() }, convertedToEventId: null },
      orderBy: { date: "asc" },
    }),
    db.event.findMany({
      where: { owningGroupId: group.id },
      orderBy: { startsAt: "desc" },
      take: 10,
      select: { id: true, title: true, startsAt: true, status: true },
    }),
    // §6.3 — cross-group claim history (active + expired + converted) for transparency.
    db.softClaim.findMany({
      where: { groupId: { not: group.id } },
      include: { group: { select: { name: true, color: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const convertedIds = claimHistory.map((c) => c.convertedToEventId).filter((x): x is string => !!x);
  const convertedEvents = convertedIds.length
    ? await db.event.findMany({
        where: { id: { in: convertedIds } },
        select: { id: true, title: true, startsAt: true },
      })
    : [];
  const convertedById = new Map(convertedEvents.map((e) => [e.id, e]));

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Admin — {group.name}</h1>
        <div className="flex gap-2">
          <Link href={`/g/${group.slug}/admin/safety-network`}><Button variant="outline" size="sm">Safety network</Button></Link>
          <Link href={`/g/${group.slug}/admin/signals`}><Button variant="outline" size="sm">Signals</Button></Link>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Soft-claims</h2>
        <SoftClaimForm groupId={group.id} />
        <ul className="mt-3 space-y-1 text-sm">
          {softClaims.map((c) => (
            <li key={c.id} className="text-muted-foreground">
              {new Date(c.date).toLocaleDateString()} — {c.note ?? "(no note)"} · expires {new Date(c.expiresAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Claim history (other groups)</h2>
        {claimHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No claims from other groups yet.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {claimHistory.map((c) => {
              const expired = c.expiresAt < new Date();
              const converted = c.convertedToEventId ? convertedById.get(c.convertedToEventId) : null;
              const state = converted ? "converted" : expired ? "expired" : "active";
              return (
                <li key={c.id} className="flex items-center gap-2 p-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.group.color }} />
                  <span className="font-medium">{c.group.name}</span>
                  <span className="text-muted-foreground">· {new Date(c.date).toLocaleDateString()}</span>
                  {c.note && <span className="truncate text-xs text-muted-foreground">— {c.note}</span>}
                  <span className="ml-auto text-xs">
                    {converted ? (
                      <Link href={`/e/${converted.id}`} className="text-primary hover:underline">→ {converted.title}</Link>
                    ) : (
                      <span className="text-muted-foreground">{state}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Pending join requests</h2>
        {joinRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {joinRequests.map((r) => (
              <li key={r.id}>{r.userId} — {r.message ?? "(no message)"}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Members ({members.length})</h2>
        <ul className="space-y-1 text-sm">
          {members.map((m) => (
            <li key={m.id}>
              {m.user.displayName} <span className="text-xs text-muted-foreground">{m.role}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Recent events</h2>
        <ul className="space-y-1 text-sm">
          {recentEvents.map((e) => (
            <li key={e.id}><Link href={`/e/${e.id}`} className="hover:underline">{e.title}</Link></li>
          ))}
        </ul>
        <div className="mt-3">
          <Link href="/e/new"><Button>New event</Button></Link>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Group settings</h2>
        <GroupForm initial={group} />
      </div>
    </section>
  );
}
