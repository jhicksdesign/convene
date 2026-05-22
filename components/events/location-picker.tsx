"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { CircleDot, EyeOff, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { circlePolygon } from "@/lib/geo";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const FALLBACK_LAT = 35.0844;
const FALLBACK_LNG = -106.6504;

type LocationVisibility = "PUBLIC" | "RSVP_CONFIRMED" | "DAY_OF";

// Union mirroring lib/schemas.ts `eventLocationInput`. Kept inline so this
// client component doesn't pull in Zod or server-only types.
export type LocationValue =
  | {
      kind: "pin";
      address: string;
      venueName?: string | null;
      venueNotes?: string | null;
      lat: number;
      lng: number;
      visibility: LocationVisibility;
      generalArea?: string | null;
    }
  | {
      kind: "area";
      lat: number;
      lng: number;
      radius: number;
      venueName?: string | null;
      venueNotes?: string | null;
      visibility: LocationVisibility;
      generalArea?: string | null;
    }
  | {
      kind: "tbd";
      generalArea: string;
      visibility: LocationVisibility;
    }
  | { kind: "none" };

const RADIUS_PRESETS: { label: string; meters: number }[] = [
  { label: "100m", meters: 100 },
  { label: "250m", meters: 250 },
  { label: "500m", meters: 500 },
  { label: "1km", meters: 1000 },
  { label: "2km", meters: 2000 },
];

const MODES: { id: "pin" | "area" | "tbd"; label: string; icon: typeof MapPin; hint: string }[] = [
  { id: "pin",  label: "Address",  icon: MapPin,    hint: "A specific street address." },
  { id: "area", label: "Area",     icon: CircleDot, hint: "A circle on the map — park meets, hikes, fuzzy spots." },
  { id: "tbd",  label: "TBD",      icon: EyeOff,    hint: "Hidden until you reveal it manually or after RSVP." },
];

const MAP_HEIGHT = 280;

interface GeocodeHit { address: string; lat: number; lng: number }

interface Props {
  value?: LocationValue;
  onChange(value: LocationValue): void;
  /** Used as initial map center when no value is set yet (admin's home, group region, …). */
  fallbackCenter?: { lat: number; lng: number };
}

export function LocationPicker({ value, onChange, fallbackCenter }: Props) {
  const initialKind = value?.kind && value.kind !== "none" ? value.kind : "pin";
  const [mode, setMode] = useState<"pin" | "area" | "tbd">(initialKind === "pin" || initialKind === "area" || initialKind === "tbd" ? initialKind : "pin");

  // Per-mode local state — kept here so switching modes doesn't lose the
  // data the admin just typed in another mode.
  const [pinAddress, setPinAddress] = useState(value?.kind === "pin" ? value.address : "");
  const [pinLat, setPinLat] = useState<number | null>(value?.kind === "pin" ? value.lat : null);
  const [pinLng, setPinLng] = useState<number | null>(value?.kind === "pin" ? value.lng : null);

  const [areaLat, setAreaLat] = useState<number | null>(value?.kind === "area" ? value.lat : null);
  const [areaLng, setAreaLng] = useState<number | null>(value?.kind === "area" ? value.lng : null);
  const [radius, setRadius] = useState<number>(value?.kind === "area" ? value.radius : 250);
  const [customRadius, setCustomRadius] = useState<string>("");

  const [generalArea, setGeneralArea] = useState<string>(
    (value?.kind === "tbd" && value.generalArea) ||
      (value?.kind === "pin" && value.generalArea) ||
      (value?.kind === "area" && value.generalArea) ||
      "",
  );

  const [visibility, setVisibility] = useState<LocationVisibility>(
    value && value.kind !== "none" ? value.visibility : "PUBLIC",
  );

  const [venueName, setVenueName] = useState<string>(
    (value?.kind === "pin" && value.venueName) ||
      (value?.kind === "area" && value.venueName) ||
      "",
  );
  const [venueNotes, setVenueNotes] = useState<string>(
    (value?.kind === "pin" && value.venueNotes) ||
      (value?.kind === "area" && value.venueNotes) ||
      "",
  );

  // Address search ───────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (mode !== "pin" || search.trim().length < 3) {
      setHits([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: search, limit: "5" });
        if (fallbackCenter) {
          params.set("proximityLat", String(fallbackCenter.lat));
          params.set("proximityLng", String(fallbackCenter.lng));
        }
        const r = await fetch(`/api/mapbox/geocode?${params}`);
        if (r.ok) {
          const j = await r.json();
          setHits((j.results ?? []) as GeocodeHit[]);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, mode, fallbackCenter]);

  // Map ──────────────────────────────────────────────────────────────────────
  // One Mapbox map instance shared between Pin and Area modes. The marker is
  // draggable in both modes; clicking the map in Area mode also moves the pin.
  const mapHost = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const center = useMemo<{ lat: number; lng: number }>(() => {
    if (mode === "pin" && pinLat != null && pinLng != null) return { lat: pinLat, lng: pinLng };
    if (mode === "area" && areaLat != null && areaLng != null) return { lat: areaLat, lng: areaLng };
    return fallbackCenter ?? { lat: FALLBACK_LAT, lng: FALLBACK_LNG };
  }, [mode, pinLat, pinLng, areaLat, areaLng, fallbackCenter]);

  // Init the map once when token is available and the host node exists.
  useEffect(() => {
    if (mode === "tbd") return;
    if (!TOKEN || !mapHost.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: mapHost.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [center.lng, center.lat],
      zoom: 12,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("radius", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "radius-fill",
        type: "fill",
        source: "radius",
        paint: { "fill-color": "#C04E22", "fill-opacity": 0.18 },
      });
      map.addLayer({
        id: "radius-stroke",
        type: "line",
        source: "radius",
        paint: { "line-color": "#C04E22", "line-width": 1.5, "line-opacity": 0.9 },
      });
    });

    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === "tbd"]);

  // Resize the map when becoming visible after a mode switch.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    requestAnimationFrame(() => m.resize());
  }, [mode]);

  // Keep the map centered on the active point.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.easeTo({ center: [center.lng, center.lat], duration: 200 });
  }, [center.lat, center.lng]);

  // Marker placement.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    let lat: number | null = null;
    let lng: number | null = null;
    if (mode === "pin") { lat = pinLat; lng = pinLng; }
    if (mode === "area") { lat = areaLat; lng = areaLng; }

    if (lat == null || lng == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "50%";
      el.style.background = "#C04E22";
      el.style.border = "3px solid #FDF8EB";
      el.style.boxShadow = "0 2px 6px rgba(31, 24, 16, 0.35)";
      el.style.cursor = "grab";
      markerRef.current = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([lng, lat])
        .addTo(m);

      markerRef.current.on("dragend", () => {
        const ll = markerRef.current!.getLngLat();
        if (mode === "pin") {
          setPinLat(ll.lat);
          setPinLng(ll.lng);
        } else if (mode === "area") {
          setAreaLat(ll.lat);
          setAreaLng(ll.lng);
        }
      });
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
  }, [mode, pinLat, pinLng, areaLat, areaLng]);

  // Click-to-place in Area mode (and Pin mode if no marker exists yet).
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const handler = (e: mapboxgl.MapMouseEvent) => {
      if (mode === "area") {
        setAreaLat(e.lngLat.lat);
        setAreaLng(e.lngLat.lng);
      }
    };
    m.on("click", handler);
    return () => { m.off("click", handler); };
  }, [mode]);

  // Radius polygon update.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.isStyleLoaded()) return;
    const source = m.getSource("radius") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    if (mode === "area" && areaLat != null && areaLng != null && radius > 0) {
      source.setData(circlePolygon(areaLat, areaLng, radius) as GeoJSON.FeatureCollection | GeoJSON.Feature);
    } else {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, [mode, areaLat, areaLng, radius]);

  // Emit value upward ────────────────────────────────────────────────────────
  // useEffect runs after the relevant state changes; emit a fresh union value
  // matching the current mode so the parent form always has the latest.
  useEffect(() => {
    if (mode === "tbd") {
      onChange({
        kind: "tbd",
        generalArea: generalArea,
        visibility,
      });
      return;
    }
    if (mode === "pin") {
      if (!pinAddress || pinLat == null || pinLng == null) {
        onChange({ kind: "none" });
        return;
      }
      onChange({
        kind: "pin",
        address: pinAddress,
        lat: pinLat,
        lng: pinLng,
        venueName: venueName || null,
        venueNotes: venueNotes || null,
        visibility,
        generalArea: generalArea || null,
      });
      return;
    }
    if (mode === "area") {
      if (areaLat == null || areaLng == null) {
        onChange({ kind: "none" });
        return;
      }
      onChange({
        kind: "area",
        lat: areaLat,
        lng: areaLng,
        radius,
        venueName: venueName || null,
        venueNotes: venueNotes || null,
        visibility,
        generalArea: generalArea || null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pinAddress, pinLat, pinLng, areaLat, areaLng, radius, venueName, venueNotes, generalArea, visibility]);

  const pickHit = useCallback((hit: GeocodeHit) => {
    setPinAddress(hit.address);
    setPinLat(hit.lat);
    setPinLng(hit.lng);
    setHits([]);
    setSearch("");
  }, []);

  return (
    <div className="space-y-4">
      {/* Mode segmented control */}
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-primary bg-primary/8 text-foreground ring-1 ring-primary/30"
                  : "border-input bg-background hover:border-primary/40 hover:bg-accent/40",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                {m.label}
              </span>
              <span className="text-xs leading-snug text-muted-foreground">{m.hint}</span>
            </button>
          );
        })}
      </div>

      {/* PIN MODE ─────────────────────────────────────────────────────── */}
      {mode === "pin" && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="loc-search">Find an address</Label>
            <div className="relative">
              <Input
                id="loc-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="123 Main St, Albuquerque…"
                autoComplete="off"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">searching…</span>
              )}
              {hits.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-md border bg-popover shadow-md">
                  {hits.map((h) => (
                    <li key={`${h.address}-${h.lat}-${h.lng}`}>
                      <button
                        type="button"
                        onClick={() => pickHit(h)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        {h.address}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {pinAddress && (
              <p className="mt-1.5 text-xs">
                <span className="text-muted-foreground">Selected · </span>
                <span className="font-medium">{pinAddress}</span>
              </p>
            )}
          </div>

          {pinLat != null && pinLng != null && TOKEN ? (
            <div ref={mapHost} className="overflow-hidden rounded-lg border" style={{ height: MAP_HEIGHT }} />
          ) : !TOKEN ? (
            <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Map preview disabled — NEXT_PUBLIC_MAPBOX_TOKEN isn't set.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="loc-venue-name">Venue name <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="loc-venue-name"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="The Frontier"
              />
            </div>
            <div>
              <Label htmlFor="loc-general-area">General area <span className="font-normal text-muted-foreground">(shown when address is hidden)</span></Label>
              <Input
                id="loc-general-area"
                value={generalArea}
                onChange={(e) => setGeneralArea(e.target.value)}
                placeholder="Northeast Heights"
              />
            </div>
          </div>
        </div>
      )}

      {/* AREA MODE ────────────────────────────────────────────────────── */}
      {mode === "area" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {areaLat == null
              ? "Click anywhere on the map to drop a center point. Drag to fine-tune."
              : "Drag the pin to move the center; use the slider to set the meet-up radius."}
          </p>

          {TOKEN ? (
            <div ref={mapHost} className="overflow-hidden rounded-lg border" style={{ height: MAP_HEIGHT }} />
          ) : (
            <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Map disabled — NEXT_PUBLIC_MAPBOX_TOKEN isn't set, so you can't drop a point. Enter exact lat/lng below as a fallback.
            </p>
          )}

          <div>
            <Label>Radius</Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {RADIUS_PRESETS.map((p) => {
                const active = radius === p.meters && customRadius === "";
                return (
                  <button
                    key={p.meters}
                    type="button"
                    onClick={() => { setRadius(p.meters); setCustomRadius(""); }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:bg-accent",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={25}
                  max={50000}
                  step={25}
                  placeholder="Custom"
                  value={customRadius}
                  onChange={(e) => {
                    setCustomRadius(e.target.value);
                    const n = parseInt(e.target.value, 10);
                    if (!Number.isNaN(n) && n >= 25 && n <= 50000) setRadius(n);
                  }}
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">m</span>
              </div>
            </div>
          </div>

          {!TOKEN && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="area-lat">Lat</Label>
                <Input
                  id="area-lat"
                  type="number"
                  step="any"
                  value={areaLat ?? ""}
                  onChange={(e) => setAreaLat(e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div>
                <Label htmlFor="area-lng">Lng</Label>
                <Input
                  id="area-lng"
                  type="number"
                  step="any"
                  value={areaLng ?? ""}
                  onChange={(e) => setAreaLng(e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="area-venue-name">Meet-spot name <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="area-venue-name"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="The duck pond, Pavilion 3, etc."
              />
            </div>
            <div>
              <Label htmlFor="area-general-area">General area <span className="font-normal text-muted-foreground">(shown when hidden)</span></Label>
              <Input
                id="area-general-area"
                value={generalArea}
                onChange={(e) => setGeneralArea(e.target.value)}
                placeholder="Tingley Beach"
              />
            </div>
          </div>
        </div>
      )}

      {/* TBD MODE ─────────────────────────────────────────────────────── */}
      {mode === "tbd" && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">
            No specific point yet — attendees see the general area only. Edit later to add the address; confirmed RSVPs get notified automatically.
          </p>
          <div>
            <Label htmlFor="tbd-general-area">General area</Label>
            <Input
              id="tbd-general-area"
              value={generalArea}
              onChange={(e) => setGeneralArea(e.target.value)}
              placeholder="Northeast Heights, Nob Hill, somewhere downtown…"
              required
            />
          </div>
        </div>
      )}

      {/* SHARED: visibility + venue notes (Pin + Area only) */}
      {mode !== "tbd" && (
        <div>
          <Label>Who sees the exact address</Label>
          <Select value={visibility} onValueChange={(v) => setVisibility(v as LocationVisibility)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLIC">Anyone who can see the event</SelectItem>
              <SelectItem value="RSVP_CONFIRMED">Only people whose RSVP is confirmed</SelectItem>
              <SelectItem value="DAY_OF">Auto-reveal 24 hours before the event</SelectItem>
            </SelectContent>
          </Select>
          {visibility !== "PUBLIC" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Until reveal, attendees see {generalArea ? <>just &ldquo;{generalArea}&rdquo;</> : <>only the general-area text (set one above)</>}.
            </p>
          )}
        </div>
      )}

      {mode !== "tbd" && (
        <div>
          <Label htmlFor="loc-venue-notes">Venue notes <span className="font-normal text-muted-foreground">(parking, entry, accessibility specifics)</span></Label>
          <Textarea
            id="loc-venue-notes"
            rows={3}
            value={venueNotes}
            onChange={(e) => setVenueNotes(e.target.value)}
            placeholder="Park behind the building; entry is the side door past the dumpster. Sensory-friendly room is upstairs."
          />
        </div>
      )}
    </div>
  );
}
