"use client";
import { useEffect, useState } from "react";
import { getCity, type Listing } from "../rental-data";
import { parseWalkingRoute } from "../walking-route";
import {
  buildingRouteUrl,
  type CampusBuilding,
  type CampusRoute,
} from "./catalog";
import type { TransitJourney } from "./transit";
export function useBuildingRoute(
  listing: Listing | undefined,
  building: CampusBuilding | undefined,
  enabled: boolean,
) {
  const [attempt, setAttempt] = useState(0),
    [result, setResult] = useState<{
      key: string;
      route?: CampusRoute;
      error?: string;
    } | null>(null);
  const key =
    enabled && listing && building
      ? `${listing.id}:${building.id}:${attempt}`
      : "";
  useEffect(() => {
    if (!key || !listing || !building) return;
    const controller = new AbortController();
    fetch(buildingRouteUrl(listing.id, building.id), {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("楼栋路线未收录，请选择其他目的地。");
        return r.json();
      })
      .then((raw) => {
        const route = parseWalkingRoute(raw, listing, {
          ...getCity(listing.cityId),
          lng: building.lng,
          lat: building.lat,
        }) as CampusRoute;
        if (route.buildingId !== building.id)
          throw new Error("路线目的地不一致。");
        if (!controller.signal.aborted) setResult({ key, route });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error: e instanceof Error ? e.message : "Route unavailable",
          });
      });
    return () => controller.abort();
  }, [key, listing, building]);
  const current = result?.key === key ? result : null;
  return {
    route: key ? (current?.route ?? null) : null,
    status: !key
      ? ("idle" as const)
      : current?.error
        ? ("error" as const)
        : current?.route
          ? ("ready" as const)
          : ("loading" as const),
    error: current?.error,
    retry: () => setAttempt((a) => a + 1),
  };
}
export function useTransitJourney(
  listing: Listing | undefined,
  building: CampusBuilding | undefined,
  enabled: boolean,
) {
  const [attempt, setAttempt] = useState(0),
    [result, setResult] = useState<{
      key: string;
      journeys?: TransitJourney[];
      error?: string;
    } | null>(null);
  const key =
    enabled && listing && building
      ? `${listing.id}:${building.id}:${attempt}`
      : "";
  useEffect(() => {
    if (!key || !listing || !building) return;
    const controller = new AbortController();
    fetch(
      `/api/student?${new URLSearchParams({ kind: "transit", city: listing.cityId, listing: listing.id, building: building.id })}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const data = (await r.json()) as {
          error?: string;
          kind?: string;
          journeys?: TransitJourney[];
        };
        if (!r.ok) throw new Error(data.error ?? "Transit unavailable");
        if (data.kind !== "tfl-journeys" || !Array.isArray(data.journeys))
          throw new Error("请使用官方出行规划入口。");
        if (!controller.signal.aborted)
          setResult({ key, journeys: data.journeys });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error: e instanceof Error ? e.message : "Transit unavailable",
          });
      });
    return () => controller.abort();
  }, [key, listing, building]);
  const current = result?.key === key ? result : null;
  return {
    journeys: key ? (current?.journeys ?? []) : [],
    status: !key
      ? ("idle" as const)
      : current?.error
        ? ("error" as const)
        : current?.journeys
          ? ("ready" as const)
          : ("loading" as const),
    error: current?.error,
    retry: () => setAttempt((a) => a + 1),
  };
}
