// Geographic helpers shared between client and server.
// Kept tiny and dependency-free so importing from either side is cheap.

export const EARTH_RADIUS_M = 6378137; // WGS-84 mean equatorial radius

/**
 * Approximate a metric circle as a GeoJSON polygon ring (closed at the
 * start/end vertex). Used by the LocationPicker preview and the map page's
 * area-event rendering. 64 vertices is plenty smooth at any zoom level we
 * reasonably draw.
 */
export function circlePolygon(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  vertices = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] = [];
  for (let i = 0; i <= vertices; i++) {
    const angle = (i / vertices) * 2 * Math.PI;
    const dx = Math.cos(angle) * radiusMeters;
    const dy = Math.sin(angle) * radiusMeters;
    const dLat = (dy / EARTH_RADIUS_M) * (180 / Math.PI);
    const dLng =
      (dx / (EARTH_RADIUS_M * Math.cos((centerLat * Math.PI) / 180))) * (180 / Math.PI);
    ring.push([centerLng + dLng, centerLat + dLat]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} };
}
