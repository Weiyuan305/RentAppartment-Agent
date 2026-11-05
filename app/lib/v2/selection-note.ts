import type { Listing } from "../rental-data";
import { signpostMinutes, signpostPlace } from "./signpost";

export function selectionNote(listing: Listing, buildingId: string | null, budget: number | null, locale: "zh" | "en") {
  const minutes = signpostMinutes(listing, buildingId);
  const place = signpostPlace(buildingId, locale);
  if (locale === "en") {
    const commute = minutes == null ? "commute unknown" : `${minutes} min walk to ${place}`;
    const money = budget == null ? "no budget to compare yet" : listing.price <= budget ? `£${budget - listing.price} under your weekly budget` : `£${listing.price - budget} over your weekly budget`;
    return `This one is in ${listing.area}, ${commute}, ${money}. Want the contract points?`;
  }
  const commute = minutes == null ? "通勤时间未知" : `步行 ${minutes} 分钟到${place}`;
  const money = budget == null ? "还没有预算可比较" : listing.price <= budget ? `比你预算低 £${budget - listing.price}` : `比你预算高 £${listing.price - budget}`;
  return `这套在 ${listing.area}，${commute}，${money}，要不要看合同要点？`;
}
