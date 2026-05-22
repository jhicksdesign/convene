"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Pin {
  eventId: string;
  title: string;
  lat: number;
  lng: number;
  color: string;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// `??` only catches null/undefined — but a Dockerfile ARG with no value
// inlines as "" into the bundle, and Number("") is 0 (which would put
// the map in the ocean off the coast of Africa). Use a truthy check so
// empty strings fall through to the hardcoded fallback too.
const ENV_LAT = process.env.NEXT_PUBLIC_DEFAULT_MAP_CENTER_LAT;
const ENV_LNG = process.env.NEXT_PUBLIC_DEFAULT_MAP_CENTER_LNG;
const ENV_ZOOM = process.env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM;
const DEFAULT_LAT = ENV_LAT ? Number(ENV_LAT) : 35.0844;
const DEFAULT_LNG = ENV_LNG ? Number(ENV_LNG) : -106.6504;
const DEFAULT_ZOOM = ENV_ZOOM ? Number(ENV_ZOOM) : 10;

export function MapView({
  pins,
  centerLat = DEFAULT_LAT,
  centerLng = DEFAULT_LNG,
  zoom = DEFAULT_ZOOM,
}: {
  pins: Pin[];
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
}) {
  // Final guard — if any caller passes NaN (or an env var slips through
  // as a non-numeric string), fall back to ABQ rather than render at (0,0).
  const safeLat = Number.isFinite(centerLat) ? centerLat : 35.0844;
  const safeLng = Number.isFinite(centerLng) ? centerLng : -106.6504;
  const safeZoom = Number.isFinite(zoom) ? zoom : 10;

  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [safeLng, safeLat],
      zoom: safeZoom,
    });
    mapRef.current = map;
    return () => { map.remove(); };
  }, [safeLat, safeLng, safeZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const mapInstance = map;
    const markers: mapboxgl.Marker[] = [];
    const addPins = () => {
      pins.forEach((p) => {
        const el = document.createElement("div");
        el.style.width = "14px";
        el.style.height = "14px";
        el.style.borderRadius = "50%";
        el.style.background = p.color;
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 1px 3px rgba(0,0,0,.3)";
        const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
          `<a href="/e/${p.eventId}" style="font-weight:600">${p.title}</a>`,
        );
        const marker = new mapboxgl.Marker(el).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(mapInstance);
        markers.push(marker);
      });
    };
    if (mapInstance.loaded()) addPins();
    else mapInstance.once("load", addPins);
    return () => { markers.forEach((m) => m.remove()); };
  }, [pins]);

  if (!TOKEN) {
    return <div className="rounded-md border bg-muted p-4 text-sm text-muted-foreground">Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the map.</div>;
  }

  return <div ref={ref} className="h-[600px] w-full rounded-md border" />;
}
