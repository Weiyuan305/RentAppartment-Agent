import { compareListings } from "../student/planner";
import { listings as demoListings, type Listing } from "../rental-data";
import { listingVerification } from "../rental-data";
import { emptyStudentPlan, type StudentPlan } from "../student/state";

export type CompareFact = {
  id: string;
  name: string;
  area: string;
  monthly: number | "unknown";
  monthlyNote: string;
  commute: number | "unknown";
  deposit: number | "unknown";
  contract: { label: string; value: string | "unknown" }[];
  risks: string[];
};

export function compareFacts(ids: string[], destinationId: string | null, listings: Listing[] = demoListings): CompareFact[] {
  const plan: StudentPlan = { ...emptyStudentPlan(), destinationId, campusId: destinationId ? "manchester-main" : null };
  return compareListings(ids, plan, listings).map((row) => {
    const billsIncluded = row.listing.bills;
    const monthly = billsIncluded ? Math.round(row.cost.items.rent) : "unknown" as const;
    const deposit = row.listing.merchant?.deposit ?? row.cost.deposit;
    const housing = row.housing;
    const lease = housing.minLeaseMonths != null && housing.maxLeaseMonths != null
      ? `${housing.minLeaseMonths}–${housing.maxLeaseMonths} 个月`
      : "unknown";
    const risks = [
      listingVerification(row.listing) === "verified" ? "" : "核验状态是 pending，合同条款还没有核验。",
      row.listing.merchant ? "" : "这是演示坐标，不是在租的真实房源。",
      billsIncluded ? "" : "周租不含账单，账单金额未知，所以没有给出月合计。",
      housing.status === "unknown" ? "可入住状态未知。" : housing.status === "unavailable" ? "演示数据里这套标记为不可入住。" : "",
      row.commute ? "" : "没有收录到这套的路网通勤，不能估计步行时间。",
    ].filter(Boolean);
    return {
      id: row.listing.id,
      name: row.listing.name,
      area: row.listing.area,
      monthly,
      monthlyNote: billsIncluded ? "含水电网，按周租 × 52 / 12 折成月租金。" : "账单金额未收录。",
      commute: row.commute ? row.commute.minutes : "unknown",
      deposit: deposit == null ? "unknown" : deposit,
      contract: [
        { label: "可入住", value: housing.availableFrom ?? "unknown" },
        { label: "租期", value: lease },
        { label: "押金", value: deposit == null ? "unknown" : `£${deposit}` },
        { label: "取消", value: row.listing.merchant?.cancellation || "unknown" },
        { label: "担保", value: row.listing.merchant?.guarantor || "unknown" },
      ],
      risks,
    };
  });
}
