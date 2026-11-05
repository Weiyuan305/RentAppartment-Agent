import { knownCommute } from "../listing-commute";
import type { Listing } from "../rental-data";
import { buildingById } from "../student/catalog";
import { routeMinutes } from "../walking-route";

/** Yellow is a signpost background only. Text on it is SIGNPOST_INK. */
export const SIGNPOST_YELLOW = "#FFC800";
export const SIGNPOST_INK = "#15181A";
export const V2_PAPER = "#F6F5F0";
export const V2_MUTED = "#5B6166";

export function signpostPlace(buildingId: string | null, locale: "zh" | "en") {
  const building = buildingById(buildingId);
  if (!building) return locale === "zh" ? "曼彻斯特大学" : "University of Manchester";
  if (locale === "zh") {
    const zh = building.aliases.find((alias) => /[\u4e00-\u9fff]/.test(alias));
    return zh ?? building.name;
  }
  return building.name;
}

/** Minutes from the saved road network. Null when that pair was never collected. */
export function signpostMinutes(listing: Listing, buildingId: string | null) {
  const commute = knownCommute(listing, buildingId);
  return commute ? routeMinutes(commute.durationSeconds) : null;
}
