import { z } from "zod";
import { listings } from "../rental-data";
import { calendarDate } from "./state";

export const viewingItems = [
  ["light", "采光与通风", "Daylight & ventilation"],
  ["noise", "白天与夜间噪声", "Daytime & night-time noise"],
  ["damp", "潮湿、霉菌与供暖", "Damp, mould & heating"],
  ["internet", "网络与手机信号", "Internet & phone reception"],
  ["bills", "账单范围与费用上限", "Bills & usage limits"],
  ["access", "入口、楼梯与无障碍", "Entrance & step-free access"],
  ["repairs", "维修响应与联系人", "Repairs & contact details"],
] as const;
export const decisionStages = [
  ["considering", "考虑中", "Considering"],
  ["viewing", "待看房", "To view"],
  ["confirming", "待确认", "To confirm"],
  ["ruled-out", "已排除", "Ruled out"],
] as const;
const observation=z.enum(["unknown","checked","concern"]);
export const notebookSchema=z.object({
  stage:z.enum(["considering","viewing","confirming","ruled-out"]),
  notes:z.string().max(1500),
  viewedOn:calendarDate.nullable(),
  checks:z.object({light:observation,noise:observation,damp:observation,internet:observation,bills:observation,access:observation,repairs:observation}),
});
export type DecisionNote=z.infer<typeof notebookSchema>;
export function emptyDecisionNote():DecisionNote {
  return {stage:"considering",notes:"",viewedOn:null,checks:{light:"unknown",noise:"unknown",damp:"unknown",internet:"unknown",bills:"unknown",access:"unknown",repairs:"unknown"}};
}
export function readNotebook(raw:string|null):Record<string,DecisionNote> {
  try {
    const data=JSON.parse(raw??"{}");
    if(!data || typeof data!=="object" || Array.isArray(data))return {};
    return Object.fromEntries(listings.flatMap(listing=>{
      const result=notebookSchema.safeParse(data[listing.id]);
      return result.success?[[listing.id,result.data]]:[];
    }));
  }catch{return {};}
}
