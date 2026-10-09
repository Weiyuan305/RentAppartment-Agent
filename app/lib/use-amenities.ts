"use client";
import { useEffect, useState } from "react";
import type { City } from "@/lib/rental-data";
import { parseCityAmenities, type CityAmenities } from "@/lib/amenities";

const cache = new Map<string, CityAmenities>();
export function useAmenities(city: City, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const key = `${city.id}:${attempt}`;
  const [result, setResult] = useState<{ key: string; data?: CityAmenities; error?: boolean } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void (async () => {
      try {
        let data = cache.get(city.id);
        if (!data) {
          const response = await fetch(`/amenities/${city.id}.json`, { signal: controller.signal });
          if (!response.ok) throw new Error("Amenities unavailable");
          data = parseCityAmenities(await response.json(), city);
          cache.set(city.id, data);
        }
        if (!controller.signal.aborted) setResult({ key, data });
      } catch {
        if (!controller.signal.aborted) setResult({ key, error: true });
      }
    })();
    return () => controller.abort();
  }, [city, enabled, key]);
  const current = result?.key === key ? result : null;
  return {
    data: enabled ? current?.data ?? null : null,
    status: !enabled ? "idle" as const : current?.error ? "error" as const : current?.data ? "ready" as const : "loading" as const,
    retry: () => setAttempt(v => v + 1),
  };
}
