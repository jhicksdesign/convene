// Mapbox HTTP helpers (server-side). Client uses NEXT_PUBLIC_MAPBOX_TOKEN directly.
import { db } from "@/lib/db";
import { addDays } from "date-fns";

const TOKEN = process.env.MAPBOX_TOKEN ?? "";

export interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
}

export interface GeocodeOptions {
  /** Max results to return (Mapbox max is 10). Default 5 for autocomplete. */
  limit?: number;
  /** Bias results near this point — admin's home or group region. */
  proximity?: { lat: number; lng: number };
}

/**
 * Geocode a free-text query into one or more candidate addresses.
 * Returns up to `opts.limit` ranked matches; the picker uses these for
 * an autocomplete dropdown, while one-shot callers (location upsert)
 * just take the first.
 */
export async function geocode(query: string, opts: GeocodeOptions = {}): Promise<GeocodeResult[]> {
  if (!TOKEN || !query) return [];
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 10);
  const params = new URLSearchParams({
    access_token: TOKEN,
    limit: String(limit),
    autocomplete: "true",
  });
  if (opts.proximity) {
    params.set("proximity", `${opts.proximity.lng},${opts.proximity.lat}`);
  }
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const features = (data.features ?? []) as Array<{ place_name: string; center: [number, number] }>;
  return features.map((f) => ({ address: f.place_name, lng: f.center[0], lat: f.center[1] }));
}

/** Single best match — convenience for legacy callers that only need one. */
export async function geocodeOne(query: string): Promise<GeocodeResult | null> {
  const [first] = await geocode(query, { limit: 1 });
  return first ?? null;
}

export interface DirectionsResult {
  durationS: number;
  distanceM: number;
}

export async function directions(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<DirectionsResult | null> {
  if (!TOKEN) return null;

  // §12.2 — cached 7 days
  const cached = await db.directionsCache.findFirst({
    where: {
      fromLat: from.lat,
      fromLng: from.lng,
      toLat: to.lat,
      toLng: to.lng,
      expiresAt: { gt: new Date() },
    },
  });
  if (cached) return { durationS: cached.durationS, distanceM: cached.distanceM };

  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}?access_token=${TOKEN}&overview=false`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return null;
  const out: DirectionsResult = {
    durationS: Math.round(route.duration),
    distanceM: Math.round(route.distance),
  };
  await db.directionsCache.create({
    data: {
      fromLat: from.lat,
      fromLng: from.lng,
      toLat: to.lat,
      toLng: to.lng,
      durationS: out.durationS,
      distanceM: out.distanceM,
      expiresAt: addDays(new Date(), 7),
    },
  });
  return out;
}
