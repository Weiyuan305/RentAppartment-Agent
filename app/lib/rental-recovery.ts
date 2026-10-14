import { matchesFilters } from "./assistant";
import { inMapSearchArea } from "./map-search-area";
import { removeRentalFilter, type FilterKey, type FilterSnapshot } from "./rental-filter-actions";
import type { Listing } from "./rental-data";
import type { StudentPlan } from "./student/state";

export function matchingHomes(homes: Listing[], value: FilterSnapshot, plan: StudentPlan, saved: string[]) {
  return homes.filter(l=>matchesFilters(l,value.filters,{...plan,housing:value.housing}) && (!value.onlySaved||saved.includes(l.id)) && inMapSearchArea(l.lng,l.lat,value.area));
}
export function recoverySuggestions(homes: Listing[], value: FilterSnapshot, plan: StudentPlan, saved: string[]) {
  if (matchingHomes(homes,value,plan,saved).length) return [];
  // Safety/shopping are unverified preferences, not implemented exclusion predicates.
  const keys: FilterKey[] = [];
  if(value.filters.roomType!=="all")keys.push("roomType");
  if(value.filters.budget!==null)keys.push("budget");
  if(value.filters.bills)keys.push("bills");
  if(value.filters.walkMinutes!==null)keys.push("walkMinutes");
  if(value.housing.moveIn)keys.push("moveIn");
  if(value.housing.leaseMonths)keys.push("leaseMonths");
  if(value.housing.availableOnly)keys.push("availableOnly");
  if(value.onlySaved)keys.push("onlySaved");
  if(value.area)keys.push("area");
  const results: {keys:FilterKey[];value:FilterSnapshot;count:number}[]=[];
  // Offer the fewest changes that actually produce results; at most 512 combinations.
  for(let size=1;size<=keys.length;size++) {
    for(let mask=1;mask<(1<<keys.length);mask++) {
      const removed=keys.filter((_,i)=>mask&(1<<i));
      if(removed.length!==size)continue;
      const next=removed.reduce((snapshot,key)=>removeRentalFilter(snapshot,key),value);
      const count=matchingHomes(homes,next,plan,saved).length;
      if(count)results.push({keys:removed,value:next,count});
    }
    if(results.length)break;
  }
  return results.sort((a,b)=>b.count-a.count).slice(0,3);
}

export const filterNames: Record<FilterKey,[string,string]> = {
  budget:["租金上限","rent cap"], roomType:["房型","room type"], bills:["含账单要求","bills included"],
  walkMinutes:["步行时长","walking limit"], moveIn:["入住日期","move-in date"], leaseMonths:["租期","lease length"],
  availableOnly:["演示可租限制","demo availability"], onlySaved:["仅看收藏","saved only"], area:["地图范围","map area"],
  safety:["安全偏好","safety preference"], shopping:["购物偏好","shopping preference"],
};
