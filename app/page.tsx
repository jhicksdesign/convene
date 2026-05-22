import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { recommendFor } from "@/lib/recommendations";
import { format } from "date-fns";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <section className="relative mx-auto max-w-3xl py-16 text-center sm:py-24">
        {/* Atmospheric backdrop — fixed to viewport so the gradients span
            the whole screen on wide monitors, not just the centered column.
            Two-tone (warm sienna + cool dusk), gently drifting, with a
            radial-mask vignette so orbs only glow at the edges and never
            bleed under the hero text. */}
        <div aria-hidden="true" className="orb-vignette pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div
            className="orb-a absolute -left-32 -top-32 h-[24rem] w-[24rem] rounded-full opacity-65 sm:-left-48 sm:-top-40 sm:h-[48rem] sm:w-[48rem] sm:opacity-100"
            style={{ backgroundColor: "var(--color-orb-warm)", filter: "blur(90px)" }}
          />
          <div
            className="orb-b absolute -right-32 -bottom-32 h-[24rem] w-[24rem] rounded-full opacity-55 sm:-right-48 sm:-bottom-40 sm:h-[44rem] sm:w-[44rem] sm:opacity-90"
            style={{ backgroundColor: "var(--color-orb-cool)", filter: "blur(90px)" }}
          />
        </div>
        <h1
          className="font-display text-5xl font-medium leading-none tracking-tight sm:text-7xl"
          style={{ fontVariationSettings: '"opsz" 144, "SOFT" 25' }}
        >
          Convene
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          The calendar where overlapping communities see what each other is doing —
          so nobody has to schedule a meeting just to schedule a meet.
        </p>
        <div className="mt-7 flex justify-center gap-2">
          <Link href="/login"><Button size="lg">Sign in</Button></Link>
          <Link href="/groups"><Button variant="outline" size="lg">Browse groups</Button></Link>
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
      <div>
        <h1 className="font-display text-3xl font-medium leading-none tracking-tight sm:text-4xl">
          For you
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Picked for you from your groups and what's nearby.
        </p>
      </div>
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
              <Link key={r.eventId} href={`/e/${e.id}`} className="group block">
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
            );
          })}
        </div>
      )}
    </section>
  );
}
