"use client";

import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

/**
 * Drop-in component that subscribes a server-rendered page to one or more
 * realtime channels. Use it from a server component without lifting state.
 *
 *   <RealtimeSubscribe channels={["calendar", `group:${id}`]} />
 */
export function RealtimeSubscribe({ channels, intervalMs }: { channels: string[]; intervalMs?: number }) {
  useRealtimeRefresh(channels, intervalMs);
  return null;
}
