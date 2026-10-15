import type {RentalMessage} from "./contract";

const activities:Record<string,[string,string]>={
  findNearbyAmenities:["正在查询周边设施…","Looking up nearby places…"],
  focusAmenity:["正在定位地点…","Locating the place…"],
  planWalkingRoute:["正在计算步行路线…","Calculating the walking route…"],
  planCampusBuildingRoute:["正在计算到楼栋的路线…","Calculating the route to the building…"],
  planPublicTransport:["正在查询公共交通…","Checking public transport…"],
  searchListings:["正在筛选房源…","Filtering homes…"],
  searchCampusBuildings:["正在查找校园楼栋…","Finding campus buildings…"],
  compareApartments:["正在比较公寓…","Comparing homes…"],
};
/** Derive activity from streamed tool states, never a timer or simulated progress. */
export function chatActivity(messages:RentalMessage[], submitted:boolean, locale:"zh"|"en") {
  const w=(zh:string,en:string)=>locale==="zh"?zh:en;
  if(submitted)return w("正在理解你的需求…","Understanding your request…");
  const latest=messages.at(-1);
  if(latest?.role!=="assistant")return w("正在理解你的需求…","Understanding your request…");
  const pending=latest.parts.findLast(p=>p.type.startsWith("tool-") && "state" in p && (p.state==="input-available" || p.state==="input-streaming"));
  if(pending && "state" in pending){
    if(pending.state==="input-streaming")return w("正在准备查询…","Preparing the query…");
    const label=activities[pending.type.slice(5)];
    return label?label[locale==="zh"?0:1]:w("正在更新查询结果…","Updating the results…");
  }
  return w("正在整理回复…","Preparing the answer…");
}
