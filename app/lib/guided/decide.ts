import { buildingById, buildingCommute, campusBuildings } from "../student/catalog";
import { emptyMapSelection, type RentalState } from "../agent/contract";
import { knownCommute } from "../listing-commute";
import { getCity, listingVerification, type Listing } from "../rental-data";
import { emptyStudentPlan } from "../student/state";
import { metersBetween, routeMinutes } from "../walking-route";

export const questionSteps = ["building", "budget", "moveIn", "living"] as const;
export type QuestionStep = (typeof questionSteps)[number];
export type GuidedPriority = "commute" | "budget" | "bills" | "grocery" | "private";
export type GuidedLiving = "alone" | "shared";
export type GuidedAnswers = {
  buildingId: string | null;
  weeklyBudget: number | null;
  moveIn: string | null;
  living: GuidedLiving | null;
  priority: GuidedPriority;
  walkMinutes: number | null;
};

export const budgetChoices = [160, 190, 220, 280] as const;
export const moveInChoices = [
  { value: "2026-11-01", label: "2026 年 11 月" },
  { value: "2027-01-15", label: "2027 年 1 月" },
  { value: "2027-09-01", label: "2027 年 9 月" },
] as const;
export const priorityChoices: Array<{ id: GuidedPriority; label: string }> = [
  { id: "commute", label: "少走路" },
  { id: "budget", label: "少花钱" },
  { id: "bills", label: "账单写清楚" },
  { id: "grocery", label: "华人超市" },
  { id: "private", label: "自己的卫生间" },
];

const campusCenter: [number, number] = [-2.2349, 53.4668];
const snapshotMeters = 2800;

export function emptyAnswers(): GuidedAnswers {
  return { buildingId: null, weeklyBudget: null, moveIn: null, living: null, priority: "commute", walkMinutes: null };
}

export function questionBuildings() {
  return campusBuildings
    .filter(building => building.cityId === "manchester" && building.campusId === "manchester-main")
    .map(building => ({ id: building.id, title: buildingLabel(building.id), detail: building.name }));
}

export function buildingLabel(id: string | null) {
  const building = buildingById(id);
  if (!building) return "牛津路校区";
  return building.aliases.find(name => /[\u4e00-\u9fff]/.test(name)) ?? building.name;
}

export function formatPounds(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `£${rounded.toLocaleString("en-GB")}` : `£${rounded.toFixed(2)}`;
}

export function monthlyRent(listing: Listing) {
  const city = getCity(listing.cityId);
  return Math.round(listing.price * (city.period === "周" ? 52 / 12 : 1) * 100) / 100;
}

export type CommuteFact = { minutes: number; meters: number; label: string; source: "saved-walking-route" };
export type PlacePoint = { name: string; lng: number; lat: number; category: string; origin?: string };
export type GroceryFact = { status: "known"; name: string; meters: number; chinese: boolean } | { status: "unknown"; reason: string };

export function commuteFact(listing: Listing, buildingId: string | null): CommuteFact | null {
  if (buildingId) {
    const row = buildingCommute(listing.id, buildingId) ?? listing.merchant?.commutes?.[buildingId];
    const building = buildingById(buildingId);
    if (row && building?.cityId === listing.cityId) {
      return { minutes: routeMinutes(row.durationSeconds), meters: row.distanceMeters, label: buildingLabel(buildingId), source: "saved-walking-route" };
    }
  }
  const campus = knownCommute(listing);
  if (!campus) return null;
  return { minutes: routeMinutes(campus.durationSeconds), meters: campus.distanceMeters, label: "牛津路校区", source: "saved-walking-route" };
}

function isChineseGrocery(place: PlacePoint) {
  return place.category === "asian_grocery" && /chinese|中国|华人/i.test(`${place.name} ${place.origin ?? ""}`);
}

export function groceryFact(listing: Listing, places: PlacePoint[]): GroceryFact {
  if (metersBetween([listing.lng, listing.lat], campusCenter) > snapshotMeters) {
    return { status: "unknown", reason: "这套房离校区快照边缘太远，不能据此说附近没有超市。" };
  }
  const shops = places.filter(place => place.category === "asian_grocery");
  if (!shops.length) return { status: "unknown", reason: "校区快照里没有华人超市记录。" };
  let best: { place: PlacePoint; meters: number } | null = null;
  for (const place of shops) {
    const meters = Math.round(metersBetween([listing.lng, listing.lat], [place.lng, place.lat]));
    const chinese = isChineseGrocery(place);
    const bestChinese = best ? isChineseGrocery(best.place) : false;
    if (!best || (chinese && !bestChinese) || (chinese === bestChinese && meters < best.meters)) best = { place, meters };
  }
  if (!best) return { status: "unknown", reason: "校区快照里没有华人超市记录。" };
  return { status: "known", name: best.place.name, meters: best.meters, chinese: isChineseGrocery(best.place) };
}

export type ShortHome = {
  listing: Listing;
  commute: CommuteFact | null;
  grocery: GroceryFact;
  reason: string;
  sign: string;
  stretch: string[];
};

function livingFits(listing: Listing, living: GuidedLiving | null) {
  if (living === "shared") return listing.roomType === "合租单间";
  if (living === "alone") return listing.roomType !== "合租单间";
  return true;
}

function scoreHome(listing: Listing, answers: GuidedAnswers, commute: CommuteFact | null, grocery: GroceryFact) {
  const minutes = commute?.minutes ?? 75;
  let score = (90 - Math.min(minutes, 90)) * (answers.priority === "commute" ? 5 : 1);
  if (answers.weeklyBudget != null) score += (answers.weeklyBudget - listing.price) * (answers.priority === "budget" ? 2 : 0.2);
  if (listing.bills) score += answers.priority === "bills" ? 100 : 5;
  if (grocery.status === "known" && grocery.meters <= 1500) {
    score += ((1500 - grocery.meters) / 1500) * (answers.priority === "grocery" ? 200 : 8);
  }
  if (livingFits(listing, answers.living)) score += answers.living ? 30 : 0;
  if (answers.priority === "private" && listing.roomType !== "合租单间") score += 80;
  if (!commute) score -= 40;
  if (answers.living && !livingFits(listing, answers.living)) score -= 50;
  if (answers.weeklyBudget != null && listing.price > answers.weeklyBudget) score -= 50;
  if (answers.walkMinutes != null && (!commute || commute.minutes > answers.walkMinutes)) score -= 50;
  return score;
}

export function oneLineReason(listing: Listing, answers: GuidedAnswers, commute: CommuteFact | null, grocery: GroceryFact) {
  const commuteText = commute ? `步行 ${commute.minutes} 分钟到${commute.label}` : null;
  const budgetText = answers.weeklyBudget == null ? null : listing.price < answers.weeklyBudget
    ? `每周少 ${formatPounds(answers.weeklyBudget - listing.price)}`
    : listing.price > answers.weeklyBudget
      ? `每周超出预算 ${formatPounds(listing.price - answers.weeklyBudget)}`
      : "每周刚好是预算";
  const groceryText = grocery.status === "known" && grocery.meters <= 1200
    ? `直线 ${grocery.meters} 米到 ${grocery.name}${grocery.chinese ? "" : "（亚洲食品店）"}`
    : null;
  const billsText = listing.bills ? "租金已含账单" : null;
  const ordered = answers.priority === "grocery"
    ? [groceryText, commuteText, budgetText]
    : answers.priority === "budget"
      ? [budgetText, commuteText, groceryText]
      : answers.priority === "bills"
        ? [billsText, commuteText, budgetText]
        : [commuteText, budgetText, groceryText];
  const parts = ordered.filter((part): part is string => Boolean(part));
  return (parts.length ? parts : ["公开目录里能核对的条件见对比"]).slice(0, 2).join("，");
}

export function signpost(commute: CommuteFact | null) {
  return commute ? `${commute.minutes} 分钟 步行 · ${commute.label}` : "通勤未知";
}

export function shortlistHomes(listings: Listing[], answers: GuidedAnswers, places: PlacePoint[] = []): ShortHome[] {
  const cityHomes = listings.filter(listing => listing.cityId === "manchester");
  const ranked = cityHomes.map(listing => {
    const commute = commuteFact(listing, answers.buildingId);
    const grocery = groceryFact(listing, places);
    const stretch = [
      answers.living && !livingFits(listing, answers.living) ? "房型和你选的不一样" : "",
      answers.weeklyBudget != null && listing.price > answers.weeklyBudget ? "高于每周预算" : "",
      answers.walkMinutes != null && (!commute || commute.minutes > answers.walkMinutes) ? "步行时间超出你收窄的范围" : "",
    ].filter(Boolean);
    return { listing, commute, grocery, stretch, score: scoreHome(listing, answers, commute, grocery) };
  }).sort((a, b) => b.score - a.score || a.listing.id.localeCompare(b.listing.id));
  const strict = ranked.filter(home => home.stretch.length === 0);
  const chosen = (strict.length >= 3 ? strict : ranked).slice(0, 5);
  return chosen.map(home => ({
    listing: home.listing,
    commute: home.commute,
    grocery: home.grocery,
    stretch: strict.length >= 3 ? [] : home.stretch,
    reason: oneLineReason(home.listing, answers, home.commute, home.grocery),
    sign: signpost(home.commute),
  }));
}

export type Fact = { status: "known"; text: string; detail?: string } | { status: "unknown"; text: "未知"; detail: string };
export type HomeComparison = {
  listingId: string;
  name: string;
  area: string;
  monthlyTotal: Fact;
  rent: Fact;
  bills: Fact;
  commute: Fact;
  contract: Fact;
  deposit: Fact;
  trust: Fact;
  risks: string[];
};

function known(text: string, detail?: string): Fact {
  return detail ? { status: "known", text, detail } : { status: "known", text };
}
function unknown(detail: string): Fact {
  return { status: "unknown", text: "未知", detail };
}

export function compareHome(listing: Listing, answers: GuidedAnswers, places: PlacePoint[] = []): HomeComparison {
  const commute = commuteFact(listing, answers.buildingId);
  const grocery = groceryFact(listing, places);
  const rent = monthlyRent(listing);
  const merchant = listing.merchant;
  const rentText = `${formatPounds(rent)} / 月`;
  const rentDetail = `由每周 ${formatPounds(listing.price)} × 52/12 折算`;
  const risks = ["没有安全评分，不能据此判断安不安全。"];
  if (!merchant) risks.unshift("演示房源，不能预订，也没有房东合同。");
  if (!listing.bills) risks.push("水电等账单金额没有数据。");
  if (!merchant || merchant.deposit == null) risks.push("押金金额没有数据。");
  if (!commute) risks.push("步行时间没有已保存的路网。");
  if (grocery.status === "unknown") risks.push(grocery.reason);
  const contractParts = merchant
    ? [merchant.minMonths != null ? `${merchant.minMonths}–${merchant.maxMonths} 个月` : "", merchant.paymentTerms?.trim() ?? "", merchant.cancellation?.trim() ?? "", merchant.guarantor?.trim() ? `担保：${merchant.guarantor.trim()}` : ""].filter(Boolean)
    : [];
  return {
    listingId: listing.id,
    name: listing.name,
    area: listing.area,
    rent: known(rentText, rentDetail),
    bills: listing.bills
      ? known("已包含在租金里", merchant?.billDetails?.trim() || "目录只标明包含，没有分项金额。")
      : unknown("目录标明账单另计，但没有金额。"),
    monthlyTotal: listing.bills
      ? known(rentText, `${rentDetail}。账单已包含，不再另加一笔未知水电。`)
      : unknown(`租金大约 ${rentText}，加上未知账单之后的月总支出不能算。`),
    commute: commute
      ? known(`${commute.minutes} 分钟`, `${commute.meters} 米，已保存的步行路网，到${commute.label}。`)
      : unknown("没有这套房到上课地点的已保存路线。"),
    contract: contractParts.length ? known(contractParts[0], contractParts.slice(1).join(" ")) : unknown("演示目录没有租期、付款或退租条款。"),
    deposit: merchant && merchant.deposit != null ? known(formatPounds(merchant.deposit), "商家填写的押金，不计入月租。") : unknown("目录没有押金。"),
    trust: known(
      listingVerification(listing) === "verified" ? "资料已标为已审核" : "未核验",
      merchant ? "商家提交的资料。平台审核不等于实地看过，也没有安全评分。" : "没有房东或运营方名称，也没有安全评分。",
    ),
    risks,
  };
}

export function contextLine(home: ShortHome, answers: GuidedAnswers) {
  const bits = [`这套在 ${home.listing.area}`];
  if (home.commute) bits.push(`步行 ${home.commute.minutes} 分钟到${home.commute.label}`);
  else bits.push("到上课地点的步行时间还没有路网");
  if (answers.weeklyBudget != null) {
    const delta = Math.round(answers.weeklyBudget - home.listing.price);
    if (delta > 0) bits.push(`每周比预算少 ${formatPounds(delta)}`);
    else if (delta < 0) bits.push(`每周比预算高 ${formatPounds(-delta)}`);
    else bits.push("每周租金刚好是预算");
  }
  return `${bits.join("，")}。要不要看合同要点？没写出来的数字就是未知。`;
}

export function advisorWaitCopy(elapsedSeconds: number, homeCount: number) {
  if (elapsedSeconds >= 9) return "正在核对账单、押金和合同里实际写了什么…";
  if (elapsedSeconds >= 4) return "正在对步行时间和你的预算…";
  return `正在看曼城 ${homeCount} 套房…`;
}

export const rephrasePrompts = ["只比较这几套的步行时间", "哪一套把押金和账单写清楚了", "每周预算再少 20 英镑，还有合适的吗"];

export function guidedRentalState(answers: GuidedAnswers, listingId: string, routeOn: boolean): RentalState {
  const building = buildingById(answers.buildingId);
  const destinationId = building?.cityId === "manchester" ? building.id : null;
  return {
    cityId: "manchester",
    listingId: listingId || "manchester-1",
    filters: {
      roomType: answers.living === "shared" ? "合租单间" : "all",
      budget: answers.weeklyBudget,
      bills: false,
      walkMinutes: answers.walkMinutes,
      safety: false,
      shopping: false,
    },
    map: { ...emptyMapSelection(), campusRoute: routeOn && !destinationId },
    student: {
      ...emptyStudentPlan(),
      campusId: "manchester-main",
      destinationId,
      routeBuilding: routeOn && Boolean(destinationId),
    },
  };
}

export function answersFromAgent(current: GuidedAnswers, state: RentalState): GuidedAnswers {
  if (state.cityId !== "manchester") return current;
  const room = state.filters.roomType;
  const destination = state.student?.destinationId;
  const building = destination && buildingById(destination)?.cityId === "manchester" ? destination : current.buildingId;
  return {
    ...current,
    weeklyBudget: state.filters.budget,
    walkMinutes: state.filters.walkMinutes,
    living: room === "合租单间" ? "shared" : room === "all" ? current.living : "alone",
    buildingId: building,
  };
}

export type GuidedChip = { id: "school" | "budget" | "moveIn" | "living" | "walk"; label: string };

export function answerChips(answers: GuidedAnswers): GuidedChip[] {
  const chips: GuidedChip[] = [{ id: "school", label: answers.buildingId ? buildingLabel(answers.buildingId) : "曼彻斯特大学" }];
  if (answers.weeklyBudget != null) chips.push({ id: "budget", label: `每周 ${formatPounds(answers.weeklyBudget)}` });
  if (answers.moveIn) chips.push({ id: "moveIn", label: moveInChoices.find(choice => choice.value === answers.moveIn)?.label ?? answers.moveIn });
  if (answers.living) chips.push({ id: "living", label: answers.living === "shared" ? "合租" : "一个人住" });
  if (answers.walkMinutes != null) chips.push({ id: "walk", label: `步行 ${answers.walkMinutes} 分钟内` });
  return chips;
}

export function clearChip(answers: GuidedAnswers, id: GuidedChip["id"]): GuidedAnswers {
  if (id === "school") return { ...answers, buildingId: null };
  if (id === "budget") return { ...answers, weeklyBudget: null };
  if (id === "moveIn") return { ...answers, moveIn: null };
  if (id === "living") return { ...answers, living: null };
  return { ...answers, walkMinutes: null };
}
