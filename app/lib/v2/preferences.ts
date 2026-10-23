import { emptyFilters, matchesFilters, type Filters } from "../assistant";
import type { Listing } from "../rental-data";
import { buildingById } from "../student/catalog";
import { emptyStudentPlan, type StudentPlan } from "../student/state";

export type ShareChoice = "alone" | "shared";
export type PriorityChoice = "commute" | "budget" | "bills";

export type Preferences = {
  filters: Filters;
  housing: StudentPlan["housing"];
  share: ShareChoice | null;
  buildingId: string | null;
  priority: PriorityChoice | null;
  /** Curated ids from the intro. Cleared as soon as a chip changes. */
  shortlistIds: string[] | null;
};

export function emptyPreferences(): Preferences {
  return {
    filters: { ...emptyFilters },
    housing: emptyStudentPlan().housing,
    share: null,
    buildingId: null,
    priority: null,
    shortlistIds: null,
  };
}

export type V2Chip = { id: string; label: string };

export function preferenceChips(prefs: Preferences, locale: "zh" | "en"): V2Chip[] {
  const chips: V2Chip[] = [];
  const building = buildingById(prefs.buildingId);
  if (building) chips.push({ id: "building", label: locale === "zh" ? (building.aliases.find((alias) => /[\u4e00-\u9fff]/.test(alias)) ?? building.name) : building.name });
  if (prefs.filters.budget != null) chips.push({ id: "budget", label: locale === "zh" ? `≤£${prefs.filters.budget}/周` : `≤£${prefs.filters.budget}/wk` });
  if (prefs.housing.moveIn) chips.push({ id: "moveIn", label: locale === "zh" ? `入住 ${prefs.housing.moveIn}` : `Move in ${prefs.housing.moveIn}` });
  if (prefs.share === "alone") chips.push({ id: "share", label: locale === "zh" ? "单住" : "Alone" });
  if (prefs.share === "shared") chips.push({ id: "share", label: locale === "zh" ? "合租" : "Shared" });
  if (prefs.filters.roomType !== "all") chips.push({ id: "roomType", label: prefs.filters.roomType });
  if (prefs.filters.walkMinutes != null) chips.push({ id: "walk", label: locale === "zh" ? `步行 ${prefs.filters.walkMinutes} 分钟内` : `Walk ≤ ${prefs.filters.walkMinutes} min` });
  if (prefs.filters.bills) chips.push({ id: "bills", label: locale === "zh" ? "含水电网" : "Bills included" });
  if (prefs.priority === "commute") chips.push({ id: "priority", label: locale === "zh" ? "最在意通勤" : "Commute first" });
  if (prefs.priority === "budget") chips.push({ id: "priority", label: locale === "zh" ? "最在意租金" : "Rent first" });
  if (prefs.priority === "bills") chips.push({ id: "priority", label: locale === "zh" ? "最在意账单" : "Bills first" });
  return chips;
}

export function removePreference(prefs: Preferences, id: string): Preferences {
  const next: Preferences = { ...prefs, filters: { ...prefs.filters }, housing: { ...prefs.housing }, shortlistIds: null };
  if (id === "building") next.buildingId = null;
  if (id === "budget") next.filters.budget = null;
  if (id === "moveIn") next.housing.moveIn = null;
  if (id === "share") next.share = null;
  if (id === "roomType") next.filters.roomType = "all";
  if (id === "walk") next.filters.walkMinutes = null;
  if (id === "bills") next.filters.bills = false;
  if (id === "priority") next.priority = null;
  return next;
}

export function clearPreferences(): Preferences {
  return emptyPreferences();
}

export function visibleHomes(listings: Listing[], prefs: Preferences) {
  return listings.filter((listing) => {
    if (listing.cityId !== "manchester") return false;
    if (prefs.shortlistIds) return prefs.shortlistIds.includes(listing.id);
    if (prefs.share === "alone" && listing.roomType === "合租单间") return false;
    if (prefs.share === "shared" && listing.roomType !== "合租单间") return false;
    const plan = { ...emptyStudentPlan(), destinationId: prefs.buildingId, campusId: prefs.buildingId ? "manchester-main" : null, housing: prefs.housing };
    return matchesFilters(listing, prefs.filters, plan);
  });
}

export function countChangeLabel(total: number, shown: number, locale: "zh" | "en") {
  if (locale === "en") return shown === total ? `${total} homes` : `${total} → ${shown} homes`;
  return shown === total ? `${total} 套` : `${total} 套 → ${shown} 套`;
}
