"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Copy, EyeOff, MapPin, Check, CircleDot } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { circlePolygon } from "@/lib/geo";
import { formatDistanceToNow } from "date-fns";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const MAP_HEIGHT = 220;

interface PinProps {
  kind: "pin";
  address: string;
  venueName?: string | null;
  lat: number;
  lng: number;
  ownerColor: string;
}

interface AreaProps {
  kind: "area";
  lat: number;
  lng: number;
  radius: number;
  venueName?: string | null;
  ownerColor: string;
}

interface HiddenProps {
  kind: "hidden";
  generalArea: string | null;
  revealsAt: Date | string | null;
  reason: "rsvp" | "day_of";
}

interface NoneProps {
  kind: "none";
  generalArea: string | null;
}

export type LocationDisplayProps = PinProps | AreaProps | HiddenProps | NoneProps;

/**
 * Reusable display for the resolved event location. Receives the output of
 * `exposedLocation()` so it doesn't need to know about the visibility policy
 * itself — it just renders whatever it's given.
 */
export function LocationDisplay(props: LocationDisplayProps) {
  if (props.kind === "pin") return <PinDisplay {...props} />;
  if (props.kind === "area") return <AreaDisplay {...props} />;
  if (props.kind === "hidden") return <HiddenDisplay {...props} />;
  if (props.kind === "none" && props.generalArea) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        {props.generalArea}
      </p>
    );
  }
  return null;
}

function PinDisplay({ address, venueName, lat, lng }: Omit<PinProps, "kind" | "ownerColor">) {
  const [copied, setCopied] = useState(false);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="-mx-1 -my-0.5 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent"
        >
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          {venueName && <span className="font-medium">{venueName}</span>}
          <span className="text-muted-foreground">{venueName ? "· " : ""}{address}</span>
        </a>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy address"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <MapPreview lat={lat} lng={lng} />
    </div>
  );
}

function AreaDisplay({ lat, lng, radius, venueName, ownerColor }: Omit<AreaProps, "kind">) {
  const km = radius / 1000;
  const label = radius >= 1000 ? `${km % 1 === 0 ? km : km.toFixed(1)}km` : `${radius}m`;
  return (
    <div className="space-y-2">
      <p className="inline-flex items-center gap-1.5 text-sm">
        <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
        {venueName ? <span className="font-medium">{venueName}</span> : <span className="text-muted-foreground">Meet inside this area</span>}
        <span className="text-muted-foreground">· {label} radius</span>
      </p>
      <MapPreview lat={lat} lng={lng} radius={radius} circleColor={ownerColor} />
    </div>
  );
}

function HiddenDisplay({ generalArea, revealsAt, reason }: Omit<HiddenProps, "kind">) {
  const reveal = revealsAt instanceof Date ? revealsAt : revealsAt ? new Date(revealsAt) : null;
  const inFuture = reveal && reveal.getTime() > Date.now();
  return (
    <div className="rounded-lg border border-dashed border-secondary bg-accent/30 p-3 text-sm">
      <div className="flex items-start gap-2">
        <EyeOff className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div className="space-y-1">
          <p>
            {reason === "rsvp"
              ? "Address shared once your RSVP is confirmed."
              : reveal && inFuture
                ? <>Address auto-reveals <span className="font-medium">in {formatDistanceToNow(reveal)}</span>.</>
                : "Address shared closer to the event."}
          </p>
          {generalArea && (
            <p className="text-xs text-muted-foreground">
              Until then, only the general area: <span className="font-medium text-foreground">{generalArea}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MapPreview({ lat, lng, radius, circleColor }: { lat: number; lng: number; radius?: number; circleColor?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!TOKEN || !ref.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const m = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: radius ? Math.max(10, 16 - Math.log2(radius / 100)) : 14,
      interactive: false,
      attributionControl: false,
    });
    m.addControl(new mapboxgl.AttributionControl({ compact: true }));
    mapRef.current = m;
    m.on("load", () => {
      if (radius) {
        m.addSource("radius", { type: "geojson", data: circlePolygon(lat, lng, radius) });
        m.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": circleColor ?? "#C04E22", "fill-opacity": 0.18 } });
        m.addLayer({ id: "radius-stroke", type: "line", source: "radius", paint: { "line-color": circleColor ?? "#C04E22", "line-width": 1.5, "line-opacity": 0.9 } });
      } else {
        // Drop a simple marker for pin mode.
        const el = document.createElement("div");
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "50%";
        el.style.background = circleColor ?? "#C04E22";
        el.style.border = "3px solid #FDF8EB";
        el.style.boxShadow = "0 2px 6px rgba(31, 24, 16, 0.35)";
        new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(m);
      }
    });
    return () => { m.remove(); mapRef.current = null; };
  }, [lat, lng, radius, circleColor]);

  if (!TOKEN) return null;

  return (
    <div ref={ref} className="overflow-hidden rounded-lg border" style={{ height: MAP_HEIGHT }} />
  );
}
