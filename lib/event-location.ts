// §12.1 — event location helpers.
//
// One central place that decides what location data the viewer is allowed to
// see for a given event. Used by the event detail page, the map page, the
// carpool panel, and any future surface that exposes coords or addresses.
//
// The viewer's RSVP status drives the RSVP_CONFIRMED policy. Time drives the
// DAY_OF policy. PUBLIC is the default and is always visible.

export type LocationVisibility = "PUBLIC" | "RSVP_CONFIRMED" | "DAY_OF";

type ViewerRsvp =
  | "GOING"
  | "INTERESTED"
  | "MAYBE"
  | "NOT_GOING"
  | "CONDITIONAL"
  | "WAITLIST"
  | null
  | undefined;

const DAY_OF_REVEAL_HOURS = 24;
const MS_PER_HOUR = 60 * 60 * 1000;

export interface CanSeeAddressInput {
  visibility: LocationVisibility;
  startsAt: Date | string;
  viewerRsvp: ViewerRsvp;
  /** Pass `true` when the viewer is an admin of the owning or co-hosting group. */
  isAdmin?: boolean;
  /** Override for tests/SSR. Defaults to `new Date()`. */
  now?: Date;
}

/**
 * Returns true when the viewer should see the exact address/coordinates for
 * an event. Admins always see; PUBLIC events always show; RSVP_CONFIRMED needs
 * a GOING/WAITLIST RSVP; DAY_OF reveals once we're within 24h of start.
 */
export function canSeeAddress({
  visibility,
  startsAt,
  viewerRsvp,
  isAdmin = false,
  now = new Date(),
}: CanSeeAddressInput): boolean {
  if (isAdmin) return true;
  if (visibility === "PUBLIC") return true;

  if (visibility === "RSVP_CONFIRMED") {
    return viewerRsvp === "GOING" || viewerRsvp === "WAITLIST";
  }

  if (visibility === "DAY_OF") {
    const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
    const hoursUntil = (start.getTime() - now.getTime()) / MS_PER_HOUR;
    return hoursUntil <= DAY_OF_REVEAL_HOURS;
  }

  return false;
}

/**
 * Returns the moment a hidden address will auto-reveal (DAY_OF only).
 * Returns null for PUBLIC (already visible) and RSVP_CONFIRMED (gated by user
 * action, not time).
 */
export function revealsAt(visibility: LocationVisibility, startsAt: Date | string): Date | null {
  if (visibility !== "DAY_OF") return null;
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  return new Date(start.getTime() - DAY_OF_REVEAL_HOURS * MS_PER_HOUR);
}

/**
 * Coarsen a lat/lng to ~1km precision. Use this when we must send some
 * geographic hint to the client (e.g., to draw a "somewhere around here"
 * circle on the map) without leaking the exact venue.
 *
 * 0.01° latitude is ~1.1km; 0.01° longitude varies by latitude but is also
 * roughly 1km in the temperate-zone US. Good enough for "this side of town."
 */
export function coarsenCoord(c: number, precision = 0.01): number {
  return Math.round(c / precision) * precision;
}

export interface ExposedLocationPin {
  kind: "pin";
  address: string;
  venueName: string | null;
  venueNotes: string | null;
  lat: number;
  lng: number;
}

export interface ExposedLocationArea {
  kind: "area";
  lat: number;
  lng: number;
  radius: number;
  venueName: string | null;
  venueNotes: string | null;
}

export interface ExposedLocationHidden {
  kind: "hidden";
  generalArea: string | null;
  /** Coarsened to ~1km — safe to display as a fuzzy region on the map. */
  approxLat: number | null;
  approxLng: number | null;
  revealsAt: Date | null;
  reason: "rsvp" | "day_of";
}

export interface ExposedLocationNone {
  kind: "none";
  generalArea: string | null;
}

export type ExposedLocation =
  | ExposedLocationPin
  | ExposedLocationArea
  | ExposedLocationHidden
  | ExposedLocationNone;

interface EventLocationLike {
  startsAt: Date | string;
  locationVisibility: LocationVisibility;
  locationGeneralArea: string | null;
  location: {
    address: string | null;
    lat: number;
    lng: number;
    radius: number | null;
    venueName: string | null;
    venueNotes: string | null;
  } | null;
}

/**
 * Resolve what location data the viewer should actually receive. Centralises
 * the "hide-or-show" decision so pages just render whatever this returns.
 *
 * Important: when a hidden location is returned, callers MUST NOT also send
 * the exact `event.location.lat/lng` to the client — otherwise the privacy
 * gate is trivially bypassable via view-source.
 */
export function exposedLocation(
  event: EventLocationLike,
  opts: { viewerRsvp: ViewerRsvp; isAdmin?: boolean; now?: Date },
): ExposedLocation {
  const visible = canSeeAddress({
    visibility: event.locationVisibility,
    startsAt: event.startsAt,
    viewerRsvp: opts.viewerRsvp,
    isAdmin: opts.isAdmin,
    now: opts.now,
  });

  if (!event.location) {
    return { kind: "none", generalArea: event.locationGeneralArea };
  }

  if (visible) {
    if (event.location.radius != null) {
      return {
        kind: "area",
        lat: event.location.lat,
        lng: event.location.lng,
        radius: event.location.radius,
        venueName: event.location.venueName,
        venueNotes: event.location.venueNotes,
      };
    }
    if (event.location.address) {
      return {
        kind: "pin",
        address: event.location.address,
        venueName: event.location.venueName,
        venueNotes: event.location.venueNotes,
        lat: event.location.lat,
        lng: event.location.lng,
      };
    }
    // Location with neither address nor radius (shouldn't happen) — fall through.
  }

  return {
    kind: "hidden",
    generalArea: event.locationGeneralArea,
    approxLat: coarsenCoord(event.location.lat),
    approxLng: coarsenCoord(event.location.lng),
    revealsAt: revealsAt(event.locationVisibility, event.startsAt),
    reason: event.locationVisibility === "DAY_OF" ? "day_of" : "rsvp",
  };
}
