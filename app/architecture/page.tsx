import Link from "next/link";
import { db } from "@/lib/db";
import { redisEnabled } from "@/lib/redis";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface Stat { label: string; value: string; sub?: string }

async function gatherStats(): Promise<Stat[]> {
  const [
    userCount,
    activeUserCount,
    groupCount,
    eventCount,
    upcomingCount,
    rsvpCount,
    notificationCount,
    softClaimCount,
    rlBuckets,
    ticks,
    convCount,
  ] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, updatedAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    db.group.count(),
    db.event.count({ where: { cancelledAt: null } }),
    db.event.count({ where: { cancelledAt: null, startsAt: { gt: new Date() } } }),
    db.rSVP.count(),
    db.notification.count(),
    db.softClaim.count({ where: { expiresAt: { gt: new Date() }, convertedToEventId: null } }),
    db.rateLimitBucket.count({ where: { windowStart: { gt: new Date(Date.now() - 60 * 60 * 1000) } } }),
    db.changeTick.findMany({ select: { channel: true, updatedAt: true } }),
    db.convention.count(),
  ]);

  return [
    { label: "Active accounts", value: String(userCount), sub: `${activeUserCount} active this week` },
    { label: "Groups", value: String(groupCount) },
    { label: "Events (live)", value: String(eventCount), sub: `${upcomingCount} upcoming` },
    { label: "Total RSVPs", value: String(rsvpCount) },
    { label: "Notifications stored", value: String(notificationCount) },
    { label: "Active soft-claims", value: String(softClaimCount) },
    { label: "Rate-limit buckets (last hour)", value: String(rlBuckets), sub: redisEnabled ? "(Postgres fallback only — Redis is primary)" : "Postgres-only" },
    { label: "Convention seed entries", value: String(convCount) },
    { label: "Realtime channels", value: String(ticks.length), sub: ticks.slice(0, 4).map((t) => t.channel).join(", ") + (ticks.length > 4 ? ` …` : "") },
  ];
}

export default async function ArchitecturePage() {
  const stats = await gatherStats();

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Architecture</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live state of this instance. Public — nothing here exposes individual users or content. See{" "}
          <Link href="https://github.com/" className="underline">the README</Link> for the diagram and{" "}
          <Link href="https://github.com/" className="underline">docs/decisions.md</Link> for the rationale behind these numbers.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{s.value}</p>
              {s.sub && <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Stack</h2>
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          <li><strong>Web:</strong> Next.js 16 (App Router, Server Actions, Turbopack)</li>
          <li><strong>Database:</strong> Postgres 16 + pgvector + Prisma 6</li>
          <li><strong>Cache / rate-limit:</strong> Upstash Redis (with Postgres fallback)</li>
          <li><strong>Auth:</strong> Auth.js v5 — magic link + Discord OAuth</li>
          <li><strong>Realtime:</strong> Postgres LISTEN/NOTIFY → SSE</li>
          <li><strong>Storage:</strong> Cloudflare R2 (S3 SDK)</li>
          <li><strong>Email:</strong> Resend with React Email templates</li>
          <li><strong>LLM:</strong> Anthropic Sonnet (extract / assistant) + Haiku (cheap classification)</li>
          <li><strong>Embeddings:</strong> OpenAI text-embedding-3-small + pgvector</li>
          <li><strong>Maps:</strong> Mapbox (geocoding + directions + GL JS)</li>
          <li><strong>Push:</strong> Web Push with VAPID + service worker</li>
          <li><strong>Errors:</strong> Sentry</li>
          <li><strong>Hosting:</strong> Railway (Docker, managed Postgres, cron services)</li>
          <li><strong>CI:</strong> GitHub Actions — typecheck, build, Playwright e2e</li>
        </ul>
      </div>
    </section>
  );
}
