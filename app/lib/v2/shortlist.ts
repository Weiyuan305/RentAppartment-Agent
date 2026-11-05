import type { Listing } from "../rental-data";
import type { Preferences, PriorityChoice, ShareChoice } from "./preferences";
import { signpostMinutes, signpostPlace } from "./signpost";

export type IntroAnswers = {
  buildingId: string | null;
  budget: number | null;
  moveIn: string | null;
  share: ShareChoice | null;
  priority: PriorityChoice | null;
};

export function preferencesFromIntro(answers: IntroAnswers, ids: string[]): Preferences {
  return {
    filters: {
      roomType: "all",
      budget: answers.budget,
      bills: answers.priority === "bills",
      walkMinutes: answers.priority === "commute" ? 20 : null,
      safety: false,
      shopping: false,
    },
    housing: { moveIn: answers.moveIn, leaseMonths: null, availableOnly: false },
    share: answers.share,
    buildingId: answers.buildingId,
    priority: answers.priority,
    shortlistIds: ids,
  };
}

export function shortlistHomes(listings: Listing[], answers: IntroAnswers, locale: "zh" | "en") {
  const pool = listings.filter((listing) => listing.cityId === "manchester");
  const ranked = pool.map((listing) => ({ listing, score: scoreHome(listing, answers) }));
  ranked.sort((a, b) => b.score - a.score || a.listing.price - b.listing.price);
  const picked = ranked.slice(0, 5);
  const count = Math.min(5, Math.max(3, picked.length));
  return ranked.slice(0, count).map(({ listing }) => ({
    id: listing.id,
    reason: reasonLine(listing, answers, locale),
  }));
}

function scoreHome(listing: Listing, answers: IntroAnswers) {
  let score = 0;
  const minutes = signpostMinutes(listing, answers.buildingId);
  if (answers.share === "alone" && listing.roomType !== "合租单间") score += 4;
  if (answers.share === "shared" && listing.roomType === "合租单间") score += 4;
  if (answers.budget != null) score += listing.price <= answers.budget ? 5 : -4;
  if (minutes != null) score += Math.max(0, 10 - minutes / 4);
  if (answers.priority === "bills" && listing.bills) score += 4;
  if (answers.priority === "budget" && answers.budget != null && listing.price <= answers.budget) score += 3;
  if (answers.priority === "commute" && minutes != null && minutes <= 20) score += 4;
  return score;
}

function reasonLine(listing: Listing, answers: IntroAnswers, locale: "zh" | "en") {
  const minutes = signpostMinutes(listing, answers.buildingId);
  const place = signpostPlace(answers.buildingId, locale);
  if (locale === "en") {
    const commute = minutes == null ? "Commute unknown" : `${minutes} min walk to ${place}`;
    const bills = listing.bills ? "bills included" : "bills unknown / extra";
    const budget = answers.budget == null ? "" : listing.price <= answers.budget ? `, £${answers.budget - listing.price} under budget` : `, £${listing.price - answers.budget} over budget`;
    return `${commute}, £${listing.price}/wk, ${bills}${budget}.`;
  }
  const commute = minutes == null ? "通勤时间未知" : `步行 ${minutes} 分钟到${place}`;
  const bills = listing.bills ? "含水电网" : "水电网另计";
  const budget = answers.budget == null ? "" : listing.price <= answers.budget ? `，低于预算 £${answers.budget - listing.price}` : `，高于预算 £${listing.price - answers.budget}`;
  return `${commute}，周租 £${listing.price}，${bills}${budget}。`;
}
