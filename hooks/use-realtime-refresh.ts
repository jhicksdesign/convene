"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Subscribe to one or more realtime channels.
 *
 * Strategy:
 *  1. Open an EventSource against /api/realtime/stream. As soon as the server
 *     pushes a NOTIFY for one of our channels, router.refresh().
 *  2. Run a low-frequency (60s) safety poll against /api/realtime/ticks so we
 *     recover from a dropped SSE connection without waiting for browser retry.
 *
 * Only refreshes the route — does not re-fetch from any specific endpoint.
 * Cheap and idempotent.
 */
export function useRealtimeRefresh(channels: string[], _intervalMsLegacy?: number) {
  const router = useRouter();
  const seenRef = useRef<Record<string, string> | null>(null);
  const channelsKey = channels.join(",");

  useEffect(() => {
    if (channels.length === 0) return;
    let cancelled = false;
    const query = channels.map((c) => `c=${encodeURIComponent(c)}`).join("&");

    // ── primary: SSE ───────────────────────────────────────────────
    let es: EventSource | null = null;
    function openSSE() {
      try {
        es = new EventSource(`/api/realtime/stream?${query}`);
        es.onmessage = (e) => {
          // any payload that reaches onmessage is a channel we asked for
          if (!cancelled && e.data) router.refresh();
        };
        es.onerror = () => {
          // Browser will auto-retry the EventSource. We don't need to do
          // anything here; the safety poll covers the gap.
        };
      } catch {
        es = null;
      }
    }

    // ── fallback / recovery: low-frequency poll ────────────────────
    async function poll() {
      try {
        const res = await fetch(`/api/realtime/ticks?${query}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as Record<string, string>;
        const seen = seenRef.current;
        if (seen) {
          for (const c of channels) {
            if (next[c] && next[c] !== seen[c]) {
              router.refresh();
              break;
            }
          }
        }
        seenRef.current = next;
      } catch {
        // network blip, ignore
      }
    }

    openSSE();
    poll(); // baseline
    const pollTimer = setInterval(() => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      poll();
    }, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      try { es?.close(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelsKey]);
}
