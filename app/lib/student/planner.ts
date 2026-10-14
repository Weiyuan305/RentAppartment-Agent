import { getCity, listings, type Listing } from "../rental-data";
import { buildingById, buildingCommute, campuses } from "./catalog";
import { emptyStudentPlan, studentPlanSchema, type StudentPlan } from "./state";

export type HousingDetails = {
  kind: "demo";
  availableFrom: string | null;
  availableUntil: string | null;
  minLeaseMonths: number | null;
  maxLeaseMonths: number | null;
  status: "available" | "unavailable" | "unknown";
  updatedAt: string;
};
// These dates demonstrate filters; they are never advertised as real inventory.
export function housingDetails(listing: Listing): HousingDetails {
  const n = Number(listing.id.split("-").at(-1));
  return {
    kind: "demo",
    availableFrom: n === 6 ? null : `2027-0${(n % 3) + 1}-01`,
    availableUntil: n === 6 ? null : "2028-12-31",
    minLeaseMonths: n === 6 ? null : [6, 3, 12, 6, 1][n - 1],
    maxLeaseMonths: n === 6 ? null : 24,
    status: n === 5 ? "unavailable" : n === 6 ? "unknown" : "available",
    updatedAt: "2026-10-13",
  };
}
export function validateStudentPlan(
  input: unknown,
  cityId: string,
): StudentPlan {
  const p = studentPlanSchema.parse(input ?? emptyStudentPlan());
  const validBuilding = (id: string) => buildingById(id)?.cityId === cityId;
  if (p.destinationId && !validBuilding(p.destinationId))
    throw new Error("楼栋不属于当前城市。");
  if (
    p.campusId &&
    !campuses.some((c) => c.id === p.campusId && c.cityId === cityId)
  )
    throw new Error("校区不属于当前城市。");
  if (
    p.destinationId &&
    p.campusId &&
    buildingById(p.destinationId)?.campusId !== p.campusId
  )
    throw new Error("楼栋与校区不一致。");
  if (p.catchmentMinutes && !p.destinationId)
    throw new Error("请先选择楼栋再显示步行范围。");
  if (p.routeBuilding && !p.destinationId)
    throw new Error("楼栋路线缺少目的地。");
  if (
    p.compareIds.some(
      (id) => !listings.some((l) => l.id === id && l.cityId === cityId),
    ) ||
    new Set(p.compareIds).size !== p.compareIds.length
  )
    throw new Error("对比房源必须来自同城且不可重复。");
  if (
    p.destinations.some((d) => !validBuilding(d.buildingId)) ||
    new Set(p.destinations.map((d) => d.buildingId)).size !==
      p.destinations.length
  )
    throw new Error("常用目的地必须来自同城且不可重复。");
  return p;
}
export function matchesHousing(listing: Listing, p: StudentPlan) {
  const h = housingDetails(listing),
    f = p.housing;
  if (f.availableOnly && h.status !== "available") return false;
  if (
    f.moveIn &&
    (!h.availableFrom ||
      !h.availableUntil ||
      h.status !== "available" ||
      f.moveIn < h.availableFrom ||
      f.moveIn > h.availableUntil)
  )
    return false;
  if (
    f.leaseMonths &&
    (h.minLeaseMonths === null ||
      h.maxLeaseMonths === null ||
      f.leaseMonths < h.minLeaseMonths ||
      f.leaseMonths > h.maxLeaseMonths)
  )
    return false;
  if (f.moveIn && f.leaseMonths) {
    const start = new Date(`${f.moveIn}T00:00:00Z`),
      day = start.getUTCDate();
    const end = new Date(start);
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + f.leaseMonths);
    const lastDay = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
    ).getUTCDate();
    end.setUTCDate(Math.min(day, lastDay));
    end.setUTCDate(end.getUTCDate() - 1);
    if (!h.availableUntil || end.toISOString().slice(0, 10) > h.availableUntil)
      return false;
  }
  return true;
}
const round = (v: number) => Math.round(v * 100) / 100;
export function monthlyCost(listing: Listing, p: StudentPlan) {
  const city = getCity(listing.cityId),
    rent = round(listing.price * (city.period === "周" ? 52 / 12 : 1));
  const items = {
    rent,
    utilities: listing.bills ? 0 : p.expenses.utilities,
    internet: listing.bills ? 0 : p.expenses.internet,
    transport: p.expenses.transport,
    other: p.expenses.other,
  };
  const unknown = Object.entries(items)
    .filter(([, v]) => v === null)
    .map(([k]) => k);
  const knownSubtotal = round(
    Object.values(items).reduce<number>((sum, v) => sum + (v ?? 0), 0),
  );
  const oneOff = p.expenses.oneOff,
    deposit = p.expenses.deposit;
  return {
    currency: city.currency,
    items,
    knownSubtotal,
    monthlyTotal: unknown.length ? null : knownSubtotal,
    unknown,
    deposit,
    oneOff,
    initialOutlay:
      unknown.length || deposit === null || oneOff === null
        ? null
        : round(knownSubtotal + deposit + oneOff),
    assumptions:
      "用户估算；含账单房源的水电网按已包含处理；押金单独展示，不计入月支出。",
  };
}
export function weeklyCommute(listingId: string, p: StudentPlan) {
  const destinations = p.destinations.map((d) => {
    const b = buildingById(d.buildingId)!,
      r = buildingCommute(listingId, b.id);
    return {
      ...d,
      name: b.name,
      distanceMeters: r?.distanceMeters ?? null,
      oneWayMinutes: r ? Math.ceil(r.durationSeconds / 60) : null,
      weeklySeconds: r ? r.durationSeconds * d.visitsPerWeek * 2 : null,
    };
  });
  return {
    destinations,
    weeklyMinutes:
      destinations.length && destinations.every((d) => d.weeklySeconds !== null)
        ? Math.ceil(destinations.reduce((s, d) => s + d.weeklySeconds!, 0) / 60)
        : null,
    roundTrips: true,
  };
}
export function compareListings(ids: string[], p: StudentPlan) {
  return ids.map((id) => {
    const l = listings.find((l) => l.id === id);
    if (!l) throw new Error("无效房源。");
    const commute = buildingCommute(id, p.destinationId);
    return {
      listing: l,
      housing: housingDetails(l),
      cost: monthlyCost(l, p),
      destination: buildingById(p.destinationId)?.name ?? null,
      commute: commute
        ? {
            distanceMeters: commute.distanceMeters,
            minutes: Math.ceil(commute.durationSeconds / 60),
            source: commute.source,
          }
        : null,
      weekly: weeklyCommute(id, p),
    };
  });
}
export function comparisonSearch(cityId: string, p: StudentPlan) {
  const params = new URLSearchParams({
    city: cityId,
    compare: p.compareIds.join(","),
    share: "1",
  });
  if (p.destinationId) params.set("building", p.destinationId);
  return params.toString();
}
