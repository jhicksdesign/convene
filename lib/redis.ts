// Optional Upstash Redis client. Falls back to null when env is unset —
// callers must check before using and have a Postgres-backed alternative.
import { Redis } from "@upstash/redis";

let client: Redis | null = null;

function init(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function redis(): Redis | null {
  if (client === null) client = init();
  return client;
}

export const redisEnabled = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
