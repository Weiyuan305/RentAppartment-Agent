import type { RentalState } from "./contract";
import { amenityInfo } from "../amenities";
import { filterNames } from "../rental-recovery";
import { emptyStudentPlan } from "../student/state";
import { buildingById } from "../student/catalog";
import { getCity, listings as demoListings, type Listing } from "../rental-data";
export function actionChanges(before: RentalState, after: RentalState, locale:"zh"|"en", t:(s:string)=>string, listings:Listing[]=demoListings) {
  const w=(zh:string,en:string)=>locale==="zh"?zh:en, result:string[]=[];
  const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
  for(const key of Object.keys(before.filters) as (keyof RentalState["filters"])[]) {
    if(equal(before.filters[key],after.filters[key]))continue;
    const value=after.filters[key],name=filterNames[key][locale==="zh"?0:1];
    const text=value===null||value===false||value==="all"?w("不限","Any"):value===true?w("已开启","On"):key==="budget"?`${getCity(after.cityId).currency}${value}`:key==="walkMinutes"?`${value} ${w("分钟","min")}`:t(String(value));
    result.push(`${name} · ${text}`);
  }
  const added=after.map.categories.filter(c=>!before.map.categories.includes(c)),removed=before.map.categories.filter(c=>!after.map.categories.includes(c));
  if(added.length)result.push(`${w("已开启","Shown")} ${added.map(c=>t(amenityInfo[c].name)).join("、")}`);
  if(removed.length)result.push(`${w("已关闭","Hidden")} ${removed.map(c=>t(amenityInfo[c].name)).join("、")}`);
  if(before.map.radiusMeters!==after.map.radiusMeters)result.push(`${w("设施范围","Place radius")} · ${after.map.radiusMeters?`${after.map.radiusMeters} m`:w("校区快照","Campus snapshot")}`);
  if(before.map.cuisine!==after.map.cuisine)result.push(`${w("餐饮偏好","Cuisine")} · ${after.map.cuisine||w("不限","Any")}`);
  if(!equal(before.map.placeIds,after.map.placeIds))result.push(after.map.placeIds? w(`地图显示 ${after.map.placeIds.length} 个地点`,`Map shows ${after.map.placeIds.length} places`):w("已恢复范围内地点","Places in range restored"));
  if(before.listingId!==after.listingId)result.push(`${w("选中","Selected")} · ${listings.find(l=>l.id===after.listingId)?.name??after.listingId}`);
  const a=before.student??emptyStudentPlan(), b=after.student??emptyStudentPlan();
  if(a.destinationId!==b.destinationId)result.push(`${w("通勤目的地","Destination")} · ${buildingById(b.destinationId)?.name??w("大学","University")}`);
  if(!equal(a.housing,b.housing))result.push(w("已更新入住日期、租期或可租条件","Updated move-in, lease or availability criteria"));
  if(!equal(a.expenses,b.expenses))result.push(w("已更新支出估算","Expense estimates updated"));
  if(!equal(a.compareIds,b.compareIds))result.push(w(`对比已更新 · ${b.compareIds.length} 套`,`Comparison updated · ${b.compareIds.length} homes`));
  if(!equal(a.destinations,b.destinations))result.push(w("常去地点已更新","Weekly destinations updated"));
  if(a.showBuildings!==b.showBuildings||a.buildingCategory!==b.buildingCategory||a.catchmentMinutes!==b.catchmentMinutes)result.push(w("校园图层 / 步行范围已更新","Campus layers / walking range updated"));
  if(before.map.routePlaceId!==after.map.routePlaceId||before.map.campusRoute!==after.map.campusRoute||a.routeBuilding!==b.routeBuilding||a.transitRequested!==b.transitRequested)result.push(w("路线选择已更新","Route selection updated"));
  if(before.map.selectedPlaceId!==after.map.selectedPlaceId)result.push(w("地点选择已更新","Place selection updated"));
  return result;
}
export function canUndoAgentAction(revision:number, currentRevision:number, undone=false) {return !undone&&revision===currentRevision;}
