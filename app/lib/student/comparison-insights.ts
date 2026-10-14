import type { compareListings } from "./planner";
type Row = ReturnType<typeof compareListings>[number];
export function keepComparisonRow(values:string[], unknown:boolean, differencesOnly:boolean) {
  return !differencesOnly || values.length<2 || unknown || new Set(values).size>1;
}
export function comparisonDelta(base:Row, other:Row) {
  return {
    monthly: base.cost.monthlyTotal===null||other.cost.monthlyTotal===null?null:Math.round((other.cost.monthlyTotal-base.cost.monthlyTotal)*100)/100,
    rent: Math.round((other.cost.items.rent-base.cost.items.rent)*100)/100,
    oneWayMinutes: base.commute&&other.commute?other.commute.minutes-base.commute.minutes:null,
  };
}
