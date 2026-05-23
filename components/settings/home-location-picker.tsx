"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
// Label removed — the parent ProfileForm provides the heading.

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const FALLBACK_LAT = Number(process.env.NEXT_PUBLIC_DEFAULT_MAP_CENTER_LAT ?? 35.0844);
const FALLBACK_LNG = Number(process.env.NEXT_PUBLIC_DEFAULT_MAP_CENTER_LNG ?? -106.6504);
const FALLBACK_ZOOM = Number(process.env.NEXT_PUBLIC_DEFAULT_MAP_ZOOM ?? 10);

interface Props {
  lat: number | null;
  lng: number | null;
  onChange(next: { lat: number | null; lng: number | null }): void;
  /** Shown above the map. Defaults match the profile/onboarding context. */
  label?: string;
  hint?: string;
}

interface GeocodeHit {
  address: string;
  lat: number;
  lng: number;
}

/**
 * Used for the user's HOME location on the profile. Not the same shape as
 * the event LocationPicker — we never need an address string, just the point
 * and the place name for display. Search + click-to-place + drag-pin.
 */
export function HomeLocationPicker({
  lat,
  lng,
  onChange,
  label = "Home location",
  hint = "Drives nearby-event recs and travel estimates. Click the map or search a city.",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [placeName, setPlaceName] = useState<string | null>(null);

  const hasPoint = lat != null && lng != null;
  const initialLat = lat ?? FALLBACK_LAT;
  const initialLng = lng ?? FALLBACK_LNG;

  // Initialize the map exactly once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!TOKEN) return; // graceful degradation: form still saves manual coords if user pastes them in advanced mode

    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [initialLng, initialLat],
      zoom: hasPoint ? 11 : FALLBACK_ZOOM,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("click", (e) => {
      // Drop the cached place name — coords were chosen freehand, not via search.
      setPlaceName(null);
      onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    mapRef.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render the marker reactively to lat/lng changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat == null || lng == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      setPlaceName(null);
      return;
    }
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "h-6 w-6 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-md";
      markerRef.current = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([lng, lat])
        .addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLngLat();
        setPlaceName(null);
        onChange({ lat: p.lat, lng: p.lng });
      });
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
    // No reverse-geocode call — display falls back to the search label or coords.
  }, [lat, lng, onChange]);

  // Forward-geocode the search box.
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !TOKEN) {
      setHits([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/mapbox/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("geocode failed");
      const data: { results: GeocodeHit[] } = await res.json();
      setHits(data.results ?? []);
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(id);
  }, [search, doSearch]);

  function pick(h: GeocodeHit) {
    onChange({ lat: h.lat, lng: h.lng });
    setSearch(h.address);
    setPlaceName(h.address);
    setHits([]);
    mapRef.current?.flyTo({ center: [h.lng, h.lat], zoom: 11 });
  }

  function clear() {
    onChange({ lat: null, lng: null });
    setSearch("");
    setHits([]);
  }

  if (!TOKEN) {
    return (
      <div className="rounded-md border border-dashed border-input bg-muted/20 p-3 text-sm text-muted-foreground">
        Map picker unavailable (no Mapbox token). Recommendations will still work once a token is configured.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="relative">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a city, neighborhood, or street…"
          aria-label="Search location"
        />
        {hits.length > 0 && (
          <ul className="absolute left-0 right-0 top-[calc(100%+2px)] z-20 max-h-64 overflow-y-auto rounded-md border border-input bg-popover text-popover-foreground shadow-md">
            {hits.map((h, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => pick(h)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{h.address}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {searching && <p className="mt-1 text-xs text-muted-foreground">Searching…</p>}
      </div>

      <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-md border border-input" />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {hasPoint ? (
            placeName ?? `${lat!.toFixed(4)}, ${lng!.toFixed(4)}`
          ) : (
            <span className="italic">No home set — click the map or search above.</span>
          )}
        </span>
        {hasPoint && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-foreground hover:underline"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
