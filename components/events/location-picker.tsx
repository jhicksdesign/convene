"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

// Radius is a "meeting point spread" — how far to look around the dropped pin
// to find your group. Real community meet-ups happen in the 10–100m range
// (specific bench / pavilion / fountain). Anything beyond 250m stops being a
// meeting point and starts being "somewhere in this neighborhood" — TBD mode
// is the right tool for that. Custom is still available up to 5km for the
// edge case of a wide outdoor zone.
const RADIUS_PRESETS: { label: string; meters: number }[] = [
  { label: "10m",  meters: 10  },  // right at this spot
  { label: "25m",  meters: 25  },  // look around this immediate area
  { label: "50m",  meters: 50  },  // this section of the park
  { label: "100m", meters: 100 },  // this corner / pavilion
  { label: "250m", meters: 250 },  // a whole small park
];

const DEFAULT_RADIUS = 50;

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
  // Mount gate — the picker is purely interactive (mapbox + draggable markers)
  // so we skip SSR entirely. This also guarantees no hydration mismatches:
  // the server and the first client render both produce the same placeholder.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const initialKind = value?.kind && value.kind !== "none" ? value.kind : "pin";
  const [mode, setMode] = useState<"pin" | "area" | "tbd">(initialKind === "pin" || initialKind === "area" || initialKind === "tbd" ? initialKind : "pin");

  const [pinAddress, setPinAddress] = useState(value?.kind === "pin" ? value.address : "");
  const [pinLat, setPinLat] = useState<number | null>(value?.kind === "pin" ? value.lat : null);
  const [pinLng, setPinLng] = useState<number | null>(value?.kind === "pin" ? value.lng : null);

  const [areaLat, setAreaLat] = useState<number | null>(value?.kind === "area" ? value.lat : null);
  const [areaLng, setAreaLng] = useState<number | null>(value?.kind === "area" ? value.lng : null);
  const [radius, setRadius] = useState<number>(value?.kind === "area" ? value.radius : DEFAULT_RADIUS);
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

  // Map — a single shared instance that lives across pin↔area mode switches.
  // The container is rendered once below (outside the per-mode JSX) so the map
  // never gets orphaned to an unmounted DOM node.
  const mapHost = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const showMap = mounted && mode !== "tbd" && !!TOKEN;

  // Init the map once, the first time the container appears.
  useEffect(() => {
    if (!showMap || !mapHost.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const initialCenter: [number, number] =
      mode === "pin" && pinLat != null && pinLng != null
        ? [pinLng, pinLat]
        : mode === "area" && areaLat != null && areaLng != null
          ? [areaLng, areaLat]
          : [fallbackCenter?.lng ?? FALLBACK_LNG, fallbackCenter?.lat ?? FALLBACK_LAT];
    const map = new mapboxgl.Map({
      container: mapHost.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: initialCenter,
      zoom: 12,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("radius", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
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
      map.resize(); // catch up if the container was hidden during init
    });

    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap]);

  // Mode change — resize the map (Mapbox reads container size at create time).
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const id = requestAnimationFrame(() => m.resize());
    return () => cancelAnimationFrame(id);
  }, [mode, mounted]);

  // Marker follows whichever mode is active.
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

  // Center + zoom the map on the active point when it (or the radius) changes.
  // Zoom scales with the radius so a 10m circle isn't a single pixel and a
  // 250m circle isn't off-screen. Formula: at zoom Z, 1px ≈ 156543·cos(lat)/2^Z
  // meters; we aim for the circle to span ~70px (a comfortable fraction of the
  // 280px-tall picker map).
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    let lat: number | null = null;
    let lng: number | null = null;
    let zoom: number | undefined;
    if (mode === "pin") { lat = pinLat; lng = pinLng; }
    if (mode === "area") {
      lat = areaLat; lng = areaLng;
      if (lat != null) {
        const desiredPx = 70;
        const metersPerPx = (2 * radius) / desiredPx;
        const lat0 = (lat * Math.PI) / 180;
        const z = Math.log2((156543 * Math.cos(lat0)) / metersPerPx);
        zoom = Math.min(19, Math.max(11, z));
      }
    }
    if (lat == null || lng == null) return;
    m.easeTo({ center: [lng, lat], duration: 350, ...(zoom != null && { zoom }) });
  }, [mode, pinLat, pinLng, areaLat, areaLng, radius]);

  // Click-to-place in Area mode.
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

  // Radius polygon — show only in area mode.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const apply = () => {
      const source = m.getSource("radius") as mapboxgl.GeoJSONSource | undefined;
      if (!source) return;
      if (mode === "area" && areaLat != null && areaLng != null && radius > 0) {
        source.setData(circlePolygon(areaLat, areaLng, radius) as GeoJSON.FeatureCollection | GeoJSON.Feature);
      } else {
        source.setData({ type: "FeatureCollection", features: [] });
      }
    };
    if (m.isStyleLoaded()) apply();
    else m.once("load", apply);
  }, [mode, areaLat, areaLng, radius]);

  // Emit value upward ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "tbd") {
      onChange({ kind: "tbd", generalArea, visibility });
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

  // Render a stable placeholder during SSR + first client render. The picker
  // lights up on the next paint after mount, with no hydration mismatch.
  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <div key={m.id} className="rounded-lg border border-input bg-background px-3 py-2.5">
              <span className="block text-sm font-medium">{m.label}</span>
              <span className="block text-xs leading-snug text-muted-foreground">{m.hint}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-muted/40" style={{ height: MAP_HEIGHT }} />
      </div>
    );
  }

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

      {/* PIN MODE input row */}
      {mode === "pin" && (
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
      )}

      {/* AREA MODE input row */}
      {mode === "area" && (
        <p className="text-xs text-muted-foreground">
          {areaLat == null
            ? "Click anywhere on the map to drop a center point. Drag to fine-tune."
            : "Drag the pin to move the center; use the slider to set the meet-up radius."}
        </p>
      )}

      {/* SHARED MAP — single container shared between pin + area so the map
          instance survives mode switches without being orphaned. */}
      {showMap && (
        <div ref={mapHost} className="overflow-hidden rounded-lg border" style={{ height: MAP_HEIGHT }} />
      )}
      {!TOKEN && mode !== "tbd" && (
        <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          Map preview disabled — NEXT_PUBLIC_MAPBOX_TOKEN isn&apos;t set.
        </p>
      )}

      {/* AREA radius slider — under the map */}
      {mode === "area" && (
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
                min={5}
                max={5000}
                step={5}
                placeholder="Custom"
                value={customRadius}
                onChange={(e) => {
                  setCustomRadius(e.target.value);
                  const n = parseInt(e.target.value, 10);
                  if (!Number.isNaN(n) && n >= 5 && n <= 5000) setRadius(n);
                }}
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">m</span>
            </div>
          </div>
        </div>
      )}

      {/* AREA fallback lat/lng inputs when token is missing */}
      {mode === "area" && !TOKEN && (
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

      {/* PIN + AREA: venue name + general-area pair */}
      {mode !== "tbd" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="loc-venue-name">
              {mode === "pin" ? "Venue name" : "Meet-spot name"} <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="loc-venue-name"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder={mode === "pin" ? "The Frontier" : "The duck pond, Pavilion 3, etc."}
            />
          </div>
          <div>
            <Label htmlFor="loc-general-area">General area <span className="font-normal text-muted-foreground">(shown when hidden)</span></Label>
            <Input
              id="loc-general-area"
              value={generalArea}
              onChange={(e) => setGeneralArea(e.target.value)}
              placeholder={mode === "pin" ? "Northeast Heights" : "Tingley Beach"}
            />
          </div>
        </div>
      )}

      {/* TBD MODE inputs */}
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

      {/* SHARED: visibility policy (Pin + Area only) */}
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
