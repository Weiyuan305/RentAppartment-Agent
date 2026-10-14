"use client";
import { Footprints, Wallet } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import campusCommutes from "@/lib/campus-commutes.json";
import {displayCity} from "@/lib/i18n";
import {getCity} from "@/lib/rental-data";
import type { Listing } from "@/lib/rental-data";
import type { StudentPlan } from "@/lib/student/state";
import type { Filters } from "@/lib/assistant";
import { buildingById, buildingCommute } from "@/lib/student/catalog";
import { matchesHousing, monthlyCost } from "@/lib/student/planner";

export default function DecisionSummary({listing,plan,filters,onPlan}:{listing:Listing;plan:StudentPlan;filters?:Filters;onPlan?:()=>void}) {
  const {locale}=useLocale(),w=(zh:string,en:string)=>locale==="zh"?zh:en;
  const cost=monthlyCost(listing,plan),route=plan.destinationId?buildingCommute(listing.id,plan.destinationId):(campusCommutes as Record<string,{durationSeconds:number;distanceMeters:number}>)[listing.id],destination=buildingById(plan.destinationId);
  const money=(value:number|null)=>value===null?w("待确认","Unknown"):`${cost.currency}${value.toLocaleString("en-US",{maximumFractionDigits:2})}`;
  const conditions=[
    ...(filters?.budget?[listing.price<=filters.budget?w("租金符合预算","Rent within budget"):w("租金超出预算","Rent over budget")]:[]),
    ...(filters?.bills?[listing.bills?w("演示含账单","Demo bills included"):w("账单另计","Bills extra")]:[]),
    ...(plan.housing.moveIn||plan.housing.leaseMonths||plan.housing.availableOnly?[matchesHousing(listing,plan)?w("符合演示入住条件","Matches demo move-in criteria"):w("入住条件未满足或未知","Move-in criteria unmet or unknown")]:[]),
    ...(filters?.walkMinutes?[route?(Math.ceil(route.durationSeconds/60)<=filters.walkMinutes?w("步行符合条件","Walk within your limit"):w("步行超出条件","Walk exceeds your limit")):w("楼栋通勤待确认","Building commute unknown")]:[]),
    ...(filters?.safety?[w("治安待核验","Safety unverified")]:[]),
    ...(filters?.shopping?[w("购物条件待核验","Shopping needs unverified")]:[]),
  ];
  return <div className="decision-summary">
    <div><Wallet size={16}/><span>{w("预计月支出","Estimated monthly cost")}<strong>{money(cost.monthlyTotal??cost.knownSubtotal)}{cost.monthlyTotal===null&&<small> + {w("待确认","unknown")}</small>}</strong></span></div>
    <p>{w("押金","Deposit")} {money(cost.deposit)} · {w("一次性费用","One-off fees")} {money(cost.oneOff)}</p>
    <div><Footprints size={16}/><span>{destination?.name??displayCity(getCity(listing.cityId),locale).university}<strong>{route?`${Math.ceil(route.durationSeconds/60)} ${w("分钟步行","min walk")} · ${route.distanceMeters} m`:w("路线待确认","Route not confirmed")}</strong></span></div>
    <p>{w("路网估计，入口待核验；费用沿用你的预算。","Walking estimate; entrance unverified. Costs use your budget.")}</p>
    {conditions.length>0&&<ul aria-label={w("条件匹配说明","Criteria match details")}>{conditions.map(item=><li key={item}>{item}</li>)}</ul>}
    {onPlan&&<button className="decision-edit" onClick={onPlan}>{w("调整费用与通勤条件","Edit costs & commute")}</button>}
  </div>;
}
