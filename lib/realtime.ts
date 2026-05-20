// Real-time fan-out.
//
// Server actions call `bump(channel)` after every mutation. We do two things:
//
// 1. Postgres NOTIFY on a single channel "convene" with JSON payload
//    `{channel,ts}` — the SSE route's dedicated pg client receives this
//    instantly and pushes it to all subscribed browsers.
// 2. Upsert `ChangeTick(channel, updatedAt)` — used by the polling fallback
//    at `/api/realtime/ticks` for browsers/networks that block SSE.
//
// Subscribers prefer SSE; polling is the safety net.
import { db } from "@/lib/db";

export async function bump(channel: string): Promise<void> {
  const ts = Date.now();
  const payload = JSON.stringify({ channel, ts });

  // Fire-and-forget tick write (recovery path for polling clients).
  await Promise.all([
    db.changeTick.upsert({
      where: { channel },
      create: { channel },
      update: {},
    }),
    db.$executeRawUnsafe(
      `UPDATE "ChangeTick" SET "updatedAt" = NOW() WHERE channel = $1`,
      channel,
    ),
    db.$executeRawUnsafe(`SELECT pg_notify('convene', $1)`, payload),
  ]);
}

export async function readTicks(channels: string[]): Promise<Record<string, string>> {
  if (channels.length === 0) return {};
  const rows = await db.changeTick.findMany({ where: { channel: { in: channels } } });
  const out: Record<string, string> = {};
  for (const r of rows) out[r.channel] = r.updatedAt.toISOString();
  return out;
}
