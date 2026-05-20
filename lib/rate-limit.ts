// Canonical rate-limit gate.
//
// Backed by Redis (Upstash) when configured — atomic INCR + EXPIRE, O(1).
// Falls back to Postgres `RateLimitBucket` so the app keeps working when Redis
// isn't provisioned (local dev, free-tier deploys).
import { db } from "@/lib/db";
import { redis, redisEnabled } from "@/lib/redis";
import { getCurrentUser } from "@/lib/auth-helpers";

export class RateLimitError extends Error {
  retryAt: Date;
  constructor(message: string, retryAt: Date) {
    super(message);
    this.retryAt = retryAt;
  }
}

async function consumeRedis(
  key: string,
  max: number,
  windowMs: number,
  message: string,
): Promise<void> {
  const r = redis();
  if (!r) return consumePostgres(key, max, windowMs, message);

  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const bucketKey = `rl:${key}:${window}`;

  // Atomic INCR + EXPIRE in a pipeline.
  const pipe = r.pipeline();
  pipe.incr(bucketKey);
  pipe.pexpire(bucketKey, windowMs);
  const [count] = (await pipe.exec()) as [number, unknown];

  if (count > max) {
    throw new RateLimitError(message, new Date((window + 1) * windowMs));
  }
}

async function consumePostgres(
  key: string,
  max: number,
  windowMs: number,
  message: string,
): Promise<void> {
  const now = Date.now();
  const windowStart = new Date(now - (now % windowMs));

  const bucket = await db.rateLimitBucket.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (bucket.count > max) {
    throw new RateLimitError(message, new Date(windowStart.getTime() + windowMs));
  }

  if (Math.random() < 0.01) {
    await db.rateLimitBucket.deleteMany({
      where: { key, windowStart: { lt: new Date(now - windowMs * 4) } },
    });
  }
}

/**
 * Consume one slot of a sliding window. Throws RateLimitError on overflow.
 * Routes/actions catch this and surface a clear message to the UI.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
  message = "You're doing that too fast — try again shortly.",
): Promise<void> {
  if (redisEnabled) return consumeRedis(key, max, windowMs, message);
  return consumePostgres(key, max, windowMs, message);
}

/** True if the user account is less than 1 hour old (tighter limits apply). */
export async function isFreshAccount(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!u) return true;
  return Date.now() - u.createdAt.getTime() < 60 * 60 * 1000;
}

export async function rateLimitForUser(
  userId: string,
  key: string,
  max: number,
  windowMs: number,
  message?: string,
): Promise<void> {
  const fresh = await isFreshAccount(userId);
  const effective = fresh ? Math.max(1, Math.floor(max * 0.2)) : max;
  return rateLimit(`u:${userId}:${key}`, effective, windowMs, message);
}

export async function refuseIfFresherThan(userId: string, minutes: number, message: string): Promise<void> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!u) return;
  const ageMs = Date.now() - u.createdAt.getTime();
  if (ageMs < minutes * 60_000) {
    const retryAt = new Date(u.createdAt.getTime() + minutes * 60_000);
    throw new RateLimitError(message, retryAt);
  }
}

export async function rateLimitCurrent(key: string, max: number, windowMs: number, message?: string): Promise<void> {
  const u = await getCurrentUser();
  if (!u) return;
  return rateLimitForUser(u.id, key, max, windowMs, message);
}
