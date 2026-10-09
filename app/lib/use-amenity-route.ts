"use client";
import { useEffect, useState } from "react";
import type { Listing } from "./rental-data";
import type { Amenity } from "./amenities";
import { parseAmenityWalkingRoute, type AmenityWalkingRoute } from "./walking-route";
const cache = new Map<string, {data:AmenityWalkingRoute; expires:number}>();
export function useAmenityRoute(listing: Listing | undefined, place: Amenity | undefined, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const key = enabled && listing && place ? `${listing.id}:${place.id}` : "";
  const requestKey = `${key}:${attempt}`;
  const [result, setResult] = useState<{key:string;data?:AmenityWalkingRoute;error?:string} | null>(null);
  useEffect(() => {
    if (!key || !listing || !place) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const saved = cache.get(key);
        let data = saved && saved.expires > Date.now() ? saved.data : undefined;
        if (!data) {
          const response = await fetch(`/api/amenity-route?${new URLSearchParams({city:listing.cityId,listing:listing.id,place:place.id})}`, {signal:controller.signal});
          const payload = await response.json();
          if (!response.ok) {
            const error = payload as {error?:unknown};
            throw new Error(typeof error?.error === "string" ? error.error.slice(0, 150) : "步行路线暂时无法计算。");
          }
          data = parseAmenityWalkingRoute(payload, listing, place);
          if (cache.size >= 100) cache.delete(cache.keys().next().value!);
          cache.set(key, {data,expires:Date.now() + 86400000});
        }
        if (!controller.signal.aborted) setResult({key:requestKey,data});
      } catch (e) {
        if (!controller.signal.aborted) setResult({key:requestKey,error:e instanceof Error ? e.message : "步行路线暂时无法计算。"});
      }
    })();
    return () => controller.abort();
  }, [key, listing, place, requestKey]);
  const current = result?.key === requestKey ? result : null;
  return {route:key ? current?.data ?? null : null, status:!key ? "idle" as const : current?.error ? "error" as const : current?.data ? "ready" as const : "loading" as const, error:current?.error, retry:() => setAttempt(n => n + 1)};
}
