// All times stored in UTC. Use these helpers at the display boundary.
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TZ = process.env.DEFAULT_TIMEZONE ?? "America/Denver";

export function inUserTz(d: Date, tz?: string): Date {
  return toZonedTime(d, tz ?? DEFAULT_TZ);
}

export function utcFromLocal(d: Date, tz?: string): Date {
  return fromZonedTime(d, tz ?? DEFAULT_TZ);
}

export function formatLocal(d: Date, tz: string | undefined, pattern: string): string {
  return formatInTimeZone(d, tz ?? DEFAULT_TZ, pattern);
}
