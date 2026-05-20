// Mapbox HTTP helpers (server-side). Client uses NEXT_PUBLIC_MAPBOX_TOKEN directly.
import { db } from "@/lib/db";
import { addDays } from "date-fns";

const TOKEN = process.env.MAPBOX_TOKEN ?? "";

export interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
}

export async function geocode(query: string): Promise<GeocodeResult | null> {
  if (!TOKEN || !query) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${TOKEN}&limit=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  const f = data.features?.[0];
  if (!f) return null;
  return { address: f.place_name, lng: f.center[0], lat: f.center[1] };
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
