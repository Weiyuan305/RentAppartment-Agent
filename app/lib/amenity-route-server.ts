import type { Amenity } from "./amenities.ts";
import type { Listing } from "./rental-data.ts";
import { metersBetween, parseAmenityWalkingRoute, type AmenityWalkingRoute } from "./walking-route.ts";
import { consumeQuota, database, SessionError } from "./agent/store";

export const amenityRouteEndpoint = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";
type OsrmStep = { name?: string; distance: number; geometry: { coordinates: [number, number][] }; maneuver: { type: string; modifier?: string } };
type OsrmResponse = { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[] }[] };
const turns: Record<string, string> = {left:"左转",right:"右转","slight left":"稍向左转","slight right":"稍向右转","sharp left":"向左急转","sharp right":"向右急转",straight:"直行",uturn:"掉头"};
export function normalizeAmenityRoute(payload: unknown, listing: Listing, place: Amenity, calculatedAt = new Date().toISOString()): AmenityWalkingRoute {
  const result = payload as OsrmResponse;
  const route = result.routes?.[0];
  if (result.code !== "Ok" || !route?.geometry?.coordinates?.length || route.legs?.length !== 1) throw new Error("没有找到可用的步行路网，请核对场所入口。");
  const coordinates = route.geometry.coordinates;
  let cursor = 0;
  const steps = route.legs[0].steps.map(s => {
    if (!s.geometry?.coordinates?.length || !s.maneuver || typeof s.distance !== "number") throw new Error("路线信息不完整。");
    const begin = cursor;
    cursor = Math.min(coordinates.length - 1, cursor + s.geometry.coordinates.length - 1);
    const instruction = s.maneuver.type === "depart" ? "从公寓附近道路出发" : s.maneuver.type === "arrive" ? "到达场所附近道路" : s.maneuver.type.includes("roundabout") ? "沿环岛通过" : turns[s.maneuver.modifier ?? "straight"] ?? "继续前行";
    return {instruction: `${instruction}${s.name ? ` · ${s.name}` : ""}`, distanceMeters: Math.round(s.distance), begin, end: cursor};
  });
  const origin: [number, number] = [listing.lng, listing.lat], destination: [number, number] = [place.lng, place.lat];
  return parseAmenityWalkingRoute({version:1, listingId:listing.id, cityId:listing.cityId, amenityId:place.id, mode:"pedestrian", origin, destination, coordinates,
    distanceMeters:Math.round(route.distance), durationSeconds:route.duration,
    startOffsetMeters:Math.round(metersBetween(origin, coordinates[0])), endOffsetMeters:Math.round(metersBetween(destination, coordinates.at(-1)!)), steps,
    source:{engine:"OSRM",network:"OpenStreetMap",endpoint:amenityRouteEndpoint,calculatedAt},
  }, listing, place);
}

// The sample runs as one Node process. Quota and cache survive process restarts.
const cache = new Map<string, {route:AmenityWalkingRoute; expires:number}>();
const pending = new Map<string, Promise<AmenityWalkingRoute>>();
let lastRequest = 0;
export class RouteServiceError extends Error {
  status: number;
  constructor(message: string, status = 502) {super(message); this.status = status;}
}
export async function getAmenityRoute(listing: Listing, place: Amenity): Promise<AmenityWalkingRoute> {
  const key = `${listing.id}:${place.id}`;
  const now = Date.now();
  const saved = cache.get(key);
  if (saved && saved.expires > now) return saved.route;
  const persisted = database().prepare("SELECT payload FROM routes WHERE key=? AND expires>?").get(key, now) as {payload: string} | undefined;
  if (persisted) {
    try {return parseAmenityWalkingRoute(JSON.parse(persisted.payload), listing, place);} catch {database().prepare("DELETE FROM routes WHERE key=?").run(key);}
  }
  const inProgress = pending.get(key);
  if (inProgress) return inProgress;
  if (pending.size || now - lastRequest < 1100) throw new RouteServiceError("路线服务正在处理其他请求，请稍后再试。", 429);
  try {consumeQuota("routing-global", 100, 86400000);} catch (error) {if (error instanceof SessionError) throw new RouteServiceError(error.message, error.status); throw error;}
  lastRequest = now;
  const task = (async () => {
    try {
      const url = `${amenityRouteEndpoint}/${listing.lng},${listing.lat};${place.lng},${place.lat}?overview=full&geometries=geojson&steps=true&alternatives=false`;
      const response = await fetch(url, {headers:{"User-Agent":"CampusAtlas-RentalPreview/0.1", "X-Client-Id":"campus-atlas-rental-preview"},signal:AbortSignal.timeout(20000)});
      if (response.status === 429) throw new RouteServiceError("步行路线服务繁忙，请稍后再试。", 429);
      if (!response.ok) throw new RouteServiceError("步行路线服务暂时不可用，请稍后再试。");
      const result = normalizeAmenityRoute(await response.json(), listing, place);
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, {route:result,expires:now + 86400000});
      database().prepare("DELETE FROM routes WHERE expires<?").run(now);
      database().prepare("INSERT OR REPLACE INTO routes (key,payload,expires) VALUES (?,?,?)").run(key, JSON.stringify(result), now + 86400000);
      return result;
    } catch (e) {
      if (e instanceof RouteServiceError) throw e;
      throw new RouteServiceError(e instanceof Error && /路网|入口|完整/.test(e.message) ? e.message : "无法确认这条步行路线，请核对入口或稍后重试。");
    }
  })();
  pending.set(key, task);
  try {return await task;} finally {pending.delete(key);}
}
