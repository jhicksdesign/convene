import { notFound, forbidden } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, isAdminOf } from "@/lib/auth-helpers";

export default async function EventAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const event = await db.event.findUnique({
    where: { id },
    include: { coHosts: { select: { groupId: true } } },
  });
  if (!event) notFound();
  const groupIds = [event.owningGroupId, ...event.coHosts.map((c) => c.groupId)];
  const isAdmin = (await Promise.all(groupIds.map((g) => isAdminOf(me.id, g)))).some(Boolean);
  if (!isAdmin) forbidden();

  const rsvps = await db.rSVP.findMany({
    where: { eventId: id },
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: [{ status: "asc" }, { waitlistPosition: "asc" }],
  });

  // §8.3 — flag blocked pairs among GOING RSVPs
  const going = rsvps.filter((r) => r.status === "GOING").map((r) => r.userId);
  const blockedPairs: [string, string][] = [];
  for (const a of going) {
    const blocks = await db.block.findMany({
      where: { OR: [{ blockerId: a, blockedId: { in: going } }, { blockedId: a, blockerId: { in: going } }] },
      select: { blockerId: true, blockedId: true },
    });
    for (const b of blocks) blockedPairs.push([b.blockerId, b.blockedId]);
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Attendees — {event.title}</h1>

      {blockedPairs.length > 0 && (
        <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          ⚠ Block pairs detected among GOING attendees — use admin judgement.
          <ul className="mt-1">
            {blockedPairs.map((p, i) => <li key={i}>{p[0]} ↔ {p[1]}</li>)}
          </ul>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-2">Name</th>
            <th className="py-2">Status</th>
            <th className="py-2">+1s</th>
            <th className="py-2">Position</th>
          </tr>
        </thead>
        <tbody>
          {rsvps.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-1.5">{r.user.displayName}</td>
              <td>{r.status}</td>
              <td>{r.plusOneCount}</td>
              <td>{r.waitlistPosition ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
