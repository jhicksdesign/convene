"use client";

import { useEffect, useState } from "react";

export function TravelEstimate({ eventId }: { eventId: string }) {
  const [state, setState] = useState<{ durationS: number; distanceM: number } | null | "loading" | "none">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/mapbox/directions?eventId=${encodeURIComponent(eventId)}`)
      .then((r) => (r.ok ? r.json() : { result: null }))
      .then((j) => { if (!cancelled) setState(j.result ?? "none"); })
      .catch(() => { if (!cancelled) setState("none"); });
    return () => { cancelled = true; };
  }, [eventId]);

  if (state === "loading") return null;
  if (state === "none" || state === null) return null;
  const mins = Math.round(state.durationS / 60);
  const miles = Math.round(state.distanceM / 1609.34);
  return (
    <p className="text-xs text-muted-foreground">
      ~{mins} min drive · {miles} mi from your home location.
    </p>
  );
}
