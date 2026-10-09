import type { City, Listing } from "./rental-data";

export type RouteCoordinate = [number, number]; // longitude, latitude
export type WalkingRoute = {
  version: 1;
  listingId: string;
  cityId: string;
  mode: "pedestrian";
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  coordinates: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  startOffsetMeters: number;
  endOffsetMeters: number;
  steps: { instruction: string; distanceMeters: number; begin: number; end: number }[];
  source: { engine: "Valhalla" | "OSRM"; network: "OpenStreetMap"; endpoint: string; calculatedAt: string; walkingSpeedKmh?: number };
};

export function metersBetween(a: RouteCoordinate, b: RouteCoordinate) {
  const rad = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * rad / 2) ** 2
    + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

// Valhalla JSON uses polyline6, unlike Google's usual polyline5.
export function decodePolyline(encoded: string, precision = 6): RouteCoordinate[] {
  let cursor = 0, lat = 0, lng = 0;
  const points: RouteCoordinate[] = [];
  function delta() {
    let result = 0, shift = 0, byte: number;
    do {
      if (cursor >= encoded.length || shift > 30) throw new Error("Invalid route geometry");
      byte = encoded.charCodeAt(cursor++) - 63;
      if (byte < 0 || byte > 63) throw new Error("Invalid route geometry");
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return result & 1 ? ~(result >> 1) : result >> 1;
  }
  while (cursor < encoded.length) {
    lat += delta(); lng += delta();
    points.push([lng / 10 ** precision, lat / 10 ** precision]);
    if (points.length > 20000) throw new Error("Route geometry is too large");
  }
  return points;
}

function validCoordinate(value: unknown): value is RouteCoordinate {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
    && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}
const sameCoordinate = (a: RouteCoordinate, b: RouteCoordinate) => a.every((v, i) => Math.abs(v - b[i]) < 1e-8);

function parseRouteGeometry(value: unknown, listing: Listing, cityId: string, destination: RouteCoordinate, engine: "Valhalla" | "OSRM"): WalkingRoute {
  const r = value as WalkingRoute | null;
  if (!r || r.version !== 1 || r.mode !== "pedestrian" || r.listingId !== listing.id || r.cityId !== cityId
    || !validCoordinate(r.origin) || !validCoordinate(r.destination)
    || !sameCoordinate(r.origin, [listing.lng, listing.lat]) || !sameCoordinate(r.destination, destination)
    || !Array.isArray(r.coordinates) || r.coordinates.length < 2 || r.coordinates.length > 20000
    || !r.coordinates.every(validCoordinate)) throw new Error("Route does not match this listing");
  if (!Number.isFinite(r.distanceMeters) || r.distanceMeters <= 0 || r.distanceMeters > 30000
    || !Number.isFinite(r.durationSeconds) || r.durationSeconds <= 0 || r.durationSeconds > 28800
    || !Number.isFinite(r.startOffsetMeters) || !Number.isFinite(r.endOffsetMeters)
    || r.startOffsetMeters < 0 || r.endOffsetMeters < 0 || r.startOffsetMeters > 250 || r.endOffsetMeters > 250
    || metersBetween(r.origin, r.coordinates[0]) > 250
    || metersBetween(r.destination, r.coordinates[r.coordinates.length - 1]) > 250
    || r.coordinates.some(p => metersBetween(p, r.destination) > 30000)
    || r.source?.engine !== engine || r.source.network !== "OpenStreetMap"
    || (engine === "Valhalla" && r.source.walkingSpeedKmh !== 5.1) || !Number.isFinite(Date.parse(r.source.calculatedAt))
    || !Array.isArray(r.steps) || !r.steps.length
    || !r.steps.every(s => typeof s.instruction === "string" && s.instruction.length < 2000
      && Number.isFinite(s.distanceMeters) && s.distanceMeters >= 0
      && Number.isInteger(s.begin) && Number.isInteger(s.end) && s.begin >= 0 && s.end >= s.begin && s.end < r.coordinates.length)) {
    throw new Error("Route response is incomplete");
  }
  return r;
}
export function parseWalkingRoute(value: unknown, listing: Listing, city: City): WalkingRoute {
  return parseRouteGeometry(value, listing, city.id, [city.lng, city.lat], "Valhalla");
}
export type AmenityWalkingRoute = WalkingRoute & { amenityId: string };
export function parseAmenityWalkingRoute(value: unknown, listing: Listing, place: { id: string; lng: number; lat: number }): AmenityWalkingRoute {
  const route = value as AmenityWalkingRoute | null;
  if (route?.amenityId !== place.id || route.source?.endpoint !== "https://routing.openstreetmap.de/routed-foot/route/v1/foot") throw new Error("Route does not match this facility");
  return parseRouteGeometry(route, listing, listing.cityId, [place.lng, place.lat], "OSRM") as AmenityWalkingRoute;
}

export function routeDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} 公里` : `${Math.round(meters)} 米`;
}
export function routeMinutes(seconds: number) { return Math.max(1, Math.ceil(seconds / 60)); }
