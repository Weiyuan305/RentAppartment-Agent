"use client";
import { useEffect, useState } from "react";
import { getCity, type Listing } from "@/lib/rental-data";
import { parseWalkingRoute, type WalkingRoute } from "@/lib/walking-route";

const cache = new Map<string, WalkingRoute>();
export function useWalkingRoute(listing: Listing | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: WalkingRoute; error?: boolean } | null>(null);
  const key = listing ? `${listing.id}:${attempt}` : "";
  useEffect(() => {
    if (!listing) return;
    const controller = new AbortController();
    async function load() {
      try {
        let data = cache.get(listing!.id);
        if (!data) {
          const response = await fetch(`/routes/${listing!.id}.json`, { signal: controller.signal });
          if (!response.ok) throw new Error("Route unavailable");
          data = parseWalkingRoute(await response.json(), listing!, getCity(listing!.cityId));
          cache.set(listing!.id, data);
        }
        if (!controller.signal.aborted) setResult({ key, data });
      } catch {
        if (!controller.signal.aborted) setResult({ key, error: true });
      }
    }
    void load();
    return () => controller.abort();
  }, [listing, key]);
  // Derive loading immediately when the target changes, never display the old route.
  const current = result?.key === key ? result : null;
  return {
    status: !listing ? "idle" as const : current?.error ? "error" as const : current?.data ? "ready" as const : "loading" as const,
    route: listing ? current?.data ?? null : null,
    retry: () => setAttempt(v => v + 1),
  };
}
