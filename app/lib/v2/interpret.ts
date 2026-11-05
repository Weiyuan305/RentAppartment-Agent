import type { Listing } from "../rental-data";
import { buildingsInCity } from "../student/catalog";
import type { Preferences } from "./preferences";

export type InterpretedAsk = {
  budget: number | null;
  walkMinutes: number | null;
  buildingId: string | null;
  share: Preferences["share"];
  listingIds: string[];
};

export function interpretAdvisorText(text: string, listings: Listing[]): InterpretedAsk {
  const budgetMatch = text.match(/(?:£|预算[^\d£]{0,8})(\d{2,4})/);
  const walkMatch = text.match(/(\d{1,2})\s*分钟/);
  const budget = budgetMatch ? Number(budgetMatch[1]) : null;
  const walkMinutes = walkMatch ? Number(walkMatch[1]) : null;
  const lowered = text.toLowerCase();
  const building = buildingsInCity("manchester").find((item) => {
    const names = [item.name, ...item.aliases];
    return names.some((name) => name.length > 1 && (text.includes(name) || lowered.includes(name.toLowerCase())));
  });
  const share = /合租|shared/.test(lowered) || text.includes("合租") ? "shared" as const
    : /单住|一个人|studio|alone/.test(lowered) ? "alone" as const
      : null;
  const listingIds = listings.filter((listing) => listing.cityId === "manchester" && text.includes(listing.name)).map((listing) => listing.id);
  return {
    budget: budget != null && budget >= 40 && budget <= 2000 ? budget : null,
    walkMinutes: walkMinutes != null && walkMinutes > 0 && walkMinutes <= 60 ? walkMinutes : null,
    buildingId: building?.id ?? null,
    share,
    listingIds,
  };
}

export function applyInterpretation(prefs: Preferences, ask: InterpretedAsk): Preferences {
  const next: Preferences = {
    ...prefs,
    filters: { ...prefs.filters },
    housing: { ...prefs.housing },
    shortlistIds: null,
  };
  if (ask.budget != null) next.filters.budget = ask.budget;
  if (ask.walkMinutes != null) next.filters.walkMinutes = ask.walkMinutes;
  if (ask.buildingId) next.buildingId = ask.buildingId;
  if (ask.share) next.share = ask.share;
  return next;
}
