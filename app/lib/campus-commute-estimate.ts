import { knownCommute } from "./listing-commute";
import { getCity, type Listing } from "./rental-data";
import { metersBetween, routeMinutes } from "./walking-route";

const CYCLE_METERS_PER_MINUTE = 15000 / 60;
const BUS_METERS_PER_MINUTE = 18000 / 60;
const BUS_WAIT_MINUTES = 8;
const WALK_KMH = 5.1;
/** A bus estimate is not useful on a short walk, or when it would not beat walking. */
const BUS_MIN_DISTANCE_METERS = 1200;

export type CommuteModeEstimate = { minutes: number; estimate: true };
export type CampusCommuteEstimate = {
  walk: CommuteModeEstimate;
  cycle: CommuteModeEstimate;
  bus: CommuteModeEstimate | null;
  distanceMeters: number;
  walkBasis: "road-network" | "straight-line";
  estimate: true;
};

/** Walk uses a saved road-network route when one exists. Cycle and bus are labeled estimates from that same distance. */
export function campusCommuteEstimate(listing: Listing): CampusCommuteEstimate {
  const known = knownCommute(listing);
  const city = getCity(listing.cityId);
  const distanceMeters = known
    ? known.distanceMeters
    : Math.round(metersBetween([listing.lng, listing.lat], [city.lng, city.lat]) * 1.35);
  const walkMinutes = known
    ? routeMinutes(known.durationSeconds)
    : routeMinutes((distanceMeters / 1000 / WALK_KMH) * 3600);
  const busMinutes = Math.max(1, Math.ceil(distanceMeters / BUS_METERS_PER_MINUTE) + BUS_WAIT_MINUTES);
  const showBus = distanceMeters >= BUS_MIN_DISTANCE_METERS && busMinutes < walkMinutes;
  return {
    walk: { minutes: walkMinutes, estimate: true },
    cycle: { minutes: Math.max(1, Math.ceil(distanceMeters / CYCLE_METERS_PER_MINUTE)), estimate: true },
    bus: showBus ? { minutes: busMinutes, estimate: true } : null,
    distanceMeters,
    walkBasis: known ? "road-network" : "straight-line",
    estimate: true,
  };
}
