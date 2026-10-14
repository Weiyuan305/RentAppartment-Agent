import type { Listing } from "./rental-data";
import campusCommutes from "./campus-commutes.json";
import type {StudentPlan} from "./student/state";
import {buildingCommute} from "./student/catalog";
import {matchesHousing} from "./student/planner";
export type Filters = { roomType: "all" | Listing["roomType"]; budget: number | null; bills: boolean; walkMinutes: number | null; safety: boolean; shopping: boolean };
export const emptyFilters: Filters = {roomType:"all",budget:null,bills:false,walkMinutes:null,safety:false,shopping:false};
export function matchesFilters(l: Listing, f: Filters, plan?:StudentPlan) {
  const commute = plan?.destinationId ? buildingCommute(l.id,plan.destinationId) : (campusCommutes as Record<string, {durationSeconds: number}>)[l.id];
  return (f.roomType === "all" || l.roomType === f.roomType) && (f.budget === null || l.price <= f.budget) && (!f.bills || l.bills)
    && (f.walkMinutes === null || Boolean(commute && commute.durationSeconds <= f.walkMinutes * 60)) && (!plan||matchesHousing(l,plan));
}
