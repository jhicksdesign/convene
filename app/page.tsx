import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { recommendFor } from "@/lib/recommendations";
import { format } from "date-fns";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <section className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Convene</h1>
        <p className="mt-3 text-muted-foreground">
          The calendar where overlapping communities see what each other is doing,
          so nobody has to schedule a meeting just to schedule a meet.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/login"><Button>Sign in</Button></Link>
          <Link href="/groups"><Button variant="outline">Browse groups</Button></Link>
        </div>
      </section>
    );
  }

  const recommendations = await recommendFor(user.id, 5);
  const events = await db.event.findMany({
    where: { id: { in: recommendations.map((r) => r.eventId) } },
    include: { owningGroup: { select: { name: true, color: true } } },
  });
  const byId = new Map(events.map((e) => [e.id, e]));

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">For you</h1>
      {recommendations.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing tailored for you yet"
          description="Recommendations get smarter as you join groups and RSVP to events. Start by browsing what's around."
          cta={{ label: "Browse groups", href: "/groups" }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recommendations.map((r) => {
            const e = byId.get(r.eventId);
            if (!e) return null;
            return (
              <Link key={r.eventId} href={`/e/${e.id}`}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.owningGroup.color }} />
                      <CardTitle className="text-base">{e.title}</CardTitle>
                    </div>
                    <CardDescription>
                      {format(e.startsAt, "EEE MMM d, p")} · {e.owningGroup.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    {r.reasons.join(" · ")}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
