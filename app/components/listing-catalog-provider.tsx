"use client";
import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { listings, type Listing } from "@/lib/rental-data";
import type { WalkingRoute } from "@/lib/walking-route";
const Catalogue = createContext<Listing[]>(listings);
export function ListingCatalogProvider({
  homes,
  children,
}: {
  homes: Listing[];
  children: React.ReactNode;
}) {
  const [known, setKnown] = useState<
    Record<string, { origin: number[]; dest: string; route: WalkingRoute }>
  >({});
  useEffect(() => {
    function ready(e: Event) {
      const r = (e as CustomEvent<WalkingRoute & { buildingId?: string }>)
        .detail;
      if (!r?.listingId) return;
      const key = `${r.listingId}:${r.buildingId ?? "university"}`;
      setKnown((prev) =>
        JSON.stringify(prev[key]?.route) === JSON.stringify(r)
          ? prev
          : {
              ...prev,
              [key]: {
                origin: r.origin,
                dest: r.buildingId ?? "university",
                route: r,
              },
            },
      );
    }
    window.addEventListener("atlas-merchant-route", ready);
    return () => window.removeEventListener("atlas-merchant-route", ready);
  }, []);
  const enriched = useMemo(
    () =>
      homes.map((l) => {
        if (!l.merchant) return l;
        const values = Object.values(known).filter(
          (k) =>
            k.route.listingId === l.id &&
            k.origin[0] === l.lng &&
            k.origin[1] === l.lat,
        );
        if (!values.length) return l;
        return {
          ...l,
          merchant: {
            ...l.merchant,
            commutes: {
              ...l.merchant.commutes,
              ...Object.fromEntries(
                values.map((k) => [
                  k.dest,
                  {
                    distanceMeters: k.route.distanceMeters,
                    durationSeconds: k.route.durationSeconds,
                    source: k.route.source,
                  },
                ]),
              ),
            },
          },
        };
      }),
    [homes, known],
  );
  return <Catalogue.Provider value={enriched}>{children}</Catalogue.Provider>;
}
export const useListings = () => useContext(Catalogue);
