import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { SafetyNetworkPanel } from "@/components/groups/safety-network-panel";

export default async function SafetyNetworkAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = await db.group.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!group) notFound();
  await requireAdmin(group.id);

  const edges = await db.safetyNetworkEdge.findMany({
    where: { OR: [{ groupAId: group.id }, { groupBId: group.id }] },
    include: {
      groupA: { select: { id: true, name: true, color: true } },
      groupB: { select: { id: true, name: true, color: true } },
    },
  });

  const linkedIds = new Set<string>();
  const wired = edges.map((e) => {
    const other = e.groupAId === group.id ? e.groupB : e.groupA;
    const weAreA = e.groupAId === group.id;
    const usConfirmed = weAreA ? e.confirmedByA : e.confirmedByB;
    const themConfirmed = weAreA ? e.confirmedByB : e.confirmedByA;
    linkedIds.add(other.id);
    let state: "proposed_by_us" | "incoming" | "active";
    if (usConfirmed && themConfirmed) state = "active";
    else if (usConfirmed && !themConfirmed) state = "proposed_by_us";
    else state = "incoming";
    return { otherGroup: other, state };
  });

  const candidates = await db.group.findMany({
    where: { id: { not: group.id, notIn: Array.from(linkedIds) } },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Safety network — {group.name}</h1>
      <SafetyNetworkPanel groupId={group.id} candidateGroups={candidates} edges={wired} />
    </section>
  );
}
