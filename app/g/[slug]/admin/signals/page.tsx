import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { topOverlapPartners, weeklyGoing, lapsedRegularsCount } from "@/lib/signals";
import { GoingTrendChart } from "@/components/groups/going-trend-chart";
import { SignalsOptIn, SignalsToggleOff } from "@/components/groups/signals-opt-in";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function SignalsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = await db.group.findUnique({ where: { slug }, select: { id: true, name: true, signalsOptIn: true } });
  if (!group) notFound();
  await requireAdmin(group.id);

  if (!group.signalsOptIn) {
    return (
      <section className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Signals — {group.name}</h1>
        <p className="text-sm text-muted-foreground">
          Opt in to see aggregate, anonymous attendance patterns for your group.
        </p>
        <SignalsOptIn groupId={group.id} />
      </section>
    );
  }

  const [overlap, weekly, lapsed] = await Promise.all([
    topOverlapPartners(group.id),
    weeklyGoing(group.id),
    lapsedRegularsCount(group.id),
  ]);

  const totalGoing = weekly.reduce((acc, w) => acc + w.going, 0);

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Signals — {group.name}</h1>
        <SignalsToggleOff groupId={group.id} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Attendance overlap (top 3)</CardTitle></CardHeader>
          <CardContent>
            {overlap.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overlap data yet — wait for the nightly stats job.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {overlap.map((p) => (
                  <li key={p.groupId} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.groupColor }} />
                      {p.groupName}
                    </span>
                    <span className="text-muted-foreground">{Math.round(p.overlapPct * 100)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">GOING — last 90 days</CardTitle></CardHeader>
          <CardContent>
            {totalGoing === 0 ? (
              <p className="text-sm text-muted-foreground">No GOING RSVPs in the last 90 days.</p>
            ) : (
              <>
                <GoingTrendChart data={weekly} />
                <p className="mt-1 text-xs text-muted-foreground">{totalGoing} total over {weekly.length} weeks</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Lapsed regulars</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">{lapsed}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Members who used to RSVP GOING regularly but haven't in the last 30 days. Identities aren't shown.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
