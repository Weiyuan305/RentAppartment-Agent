import campusCommutes from "./campus-commutes.json";
import { buildingCommute } from "./student/catalog";
import type { Listing } from "./rental-data";
import type { WalkingRoute } from "./walking-route";
export type CommuteSummary = Pick<
  WalkingRoute,
  "distanceMeters" | "durationSeconds"
> &
  Partial<Pick<WalkingRoute, "source">>;
export function knownCommute(
  listing: Listing,
  buildingId?: string | null,
): CommuteSummary | undefined {
  if (listing.merchant)
    return listing.merchant.commutes?.[buildingId ?? "university"];
  return buildingId
    ? buildingCommute(listing.id, buildingId)
    : (campusCommutes as Record<string, CommuteSummary>)[listing.id];
}
