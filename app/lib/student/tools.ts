import { buildingCatchment } from "./catchments";
import { tool } from "ai";
import { z } from "zod";
import type { RentalState } from "../agent/contract";
import { listings } from "../rental-data";
import { matchesFilters } from "../assistant";
import {
  buildingById,
  buildingCommute,
  searchBuildings,
  campuses,
} from "./catalog";
import {
  normalizedStudentPlan,
  studentPlanSchema,
  calendarDate,
} from "./state";
import {
  compareListings,
  comparisonSearch,
  monthlyCost,
  weeklyCommute,
  validateStudentPlan,
} from "./planner";
import { getTransitJourneys } from "./transit-server";
import { transitSources, transitDirectionsUrl } from "./transit";
import { SessionError } from "../agent/store";
import type { TransitJourney } from "./transit";
export function createStudentTools(
  get: () => RentalState,
  update: (state: RentalState) => void,
  run: <T>(fn: () => T | Promise<T>) => Promise<T>,
) {
  function current() {
    const s = get();
    return {
      s,
      p: normalizedStudentPlan(s.student),
      listing: listings.find(
        (l) => l.id === s.listingId && l.cityId === s.cityId,
      )!,
    };
  }
  function reconcile(s: RentalState) {
    const p = validateStudentPlan(s.student, s.cityId),
      found = listings.filter(
        (l) => l.cityId === s.cityId && matchesFilters(l, s.filters, p),
      );
    update({
      ...s,
      student: p,
      listingId: found.some((l) => l.id === s.listingId)
        ? s.listingId
        : (found[0]?.id ?? s.listingId),
    });
    return found;
  }
  return {
    searchCampusBuildings: tool({
      description:
        "搜索当前城市已收录校园楼栋，支持中英文/简称。只返回有来源的候选；多个近似结果先请用户选择，不猜学院的上课楼或入口。",
      inputSchema: z.object({
        query: z.string().max(100),
        campusId: z.string().max(100).optional(),
      }),
      execute: ({ query, campusId }) =>
        run(() => {
          const { s } = current();
          return {
            campuses: campuses.filter((c) => c.cityId === s.cityId),
            candidates: searchBuildings(s.cityId, query, campusId).slice(0, 20),
            coverage:
              "常用楼栋目录，非完整校园普查；mapped-entrance为OSM标注入口，开放状态未核验。",
          };
        }),
    }),
    selectCampusDestination: tool({
      description:
        "用搜索返回的楼栋ID设置通勤目的地，同步楼栋地图、筛选和比较。选择楼栋不自动计算新路线；可接着调用planCampusBuildingRoute。",
      inputSchema: z.object({ buildingId: z.string().max(100) }),
      execute: ({ buildingId }) =>
        run(() => {
          const { s, p } = current(),
            b = buildingById(buildingId);
          if (!b || b.cityId !== s.cityId)
            throw new Error("请选择当前城市已收录楼栋。");
          const found = reconcile({
            ...s,
            map: {
              ...s.map,
              campusRoute: false,
              routePlaceId: null,
              selectedPlaceId: null,
            },
            student: {
              ...p,
              destinationId: b.id,
              campusId: b.campusId,
              showBuildings: true,
              routeBuilding: false,
              transitRequested: false,
            },
          });
          return {
            destination: b,
            count: found.length,
            matchingListingIds: found.map((l) => l.id),
          };
        }),
    }),
    planCampusBuildingRoute: tool({
      description:
        "显示指定公寓ID到已选择楼栋的真实步行快照路线，并将地图起点同步为这套公寓；ID取自searchListings，用户未指定则传当前listingId。没有选择楼栋时先搜索并确认。返回真实距离/时间及入口核验状态；不得将楼栋中心称为入口。",
      inputSchema: z.object({ listingId: z.string().max(50) }),
      execute: ({ listingId }) =>
        run(() => {
          const { s, p } = current(),
            listing = listings.find(
              (l) => l.id === listingId && l.cityId === s.cityId,
            ),
            b = buildingById(p.destinationId),
            r = listing && buildingCommute(listing.id, p.destinationId);
          if (!listing) throw new Error("请选择当前城市已收录的公寓起点。");
          if (!b || !r) throw new Error("请先选择已有路线数据的校内楼栋。");
          if (!matchesFilters(listing, s.filters, p))
            throw new Error("请先调整筛选并选择符合条件的公寓。");
          update({
            ...s,
            listingId: listing.id,
            map: {
              ...s.map,
              campusRoute: false,
              routePlaceId: null,
              selectedPlaceId: null,
            },
            student: {
              ...p,
              routeBuilding: true,
              transitRequested: false,
              showBuildings: true,
            },
          });
          return {
            ...r,
            origin: listing.name,
            destination: b.name,
            locationType: b.locationType,
            minutes: Math.ceil(r.durationSeconds / 60),
            limitation:
              "演示公寓起点；楼栋入口或开放条件未实地核验，路网吸附偏移未计入通勤时间。",
          };
        }),
    }),
    showWalkingCatchment: tool({
      description:
        "在当前选定楼栋显示基于真实路网的反向10/20/30分钟步行可达区域；不是直线圆，也不等于每一处实时可通行。",
      inputSchema: z.object({ minutes: z.enum(["10", "20", "30"]) }),
      execute: ({ minutes }) =>
        run(() => {
          const { s, p } = current(),
            n = Number(minutes) as 10 | 20 | 30,
            c = buildingCatchment(p.destinationId, n);
          if (!c) throw new Error("请先选择有步行范围数据的楼栋。");
          update({
            ...s,
            student: { ...p, showBuildings: true, catchmentMinutes: n },
          });
          return {
            destination: buildingById(p.destinationId)?.name,
            minutes: n,
            source: c.source,
            method: "反向pedestrian等时圈；硬筛选仍逐公寓使用实际路线时间。",
          };
        }),
    }),
    compareApartments: tool({
      description:
        "对比当前城市最多3套公寓的月支出、选定楼栋通勤、租期/日期及多个目的地的每周通勤；地图与对比清单同步。未知费用不按0，所有房源为演示。",
      inputSchema: z.object({
        listingIds: z.array(z.string().max(50)).min(2).max(3),
      }),
      execute: ({ listingIds }) =>
        run(() => {
          const { s, p } = current(),
            next = validateStudentPlan(
              { ...p, compareIds: listingIds },
              s.cityId,
            );
          update({ ...s, student: next });
          return {
            results: compareListings(listingIds, next),
            sharePath: `/?${comparisonSearch(s.cityId, next)}`,
            inventory: "全部为不可预订的演示数据。",
          };
        }),
    }),
    updateStudentPreferences: tool({
      description:
        "更新入住日期、租期月数、演示可租筛选，或月度水电/网络/交通/其他预算、押金、一次性费用（当前城市币种）。金额是用户假设，缺失保持未知。省略字段沿用；显式clearMoveIn/clearLease/resetExpenses清除。",
      inputSchema: z.object({
        moveIn: calendarDate.optional(),
        leaseMonths: z.number().int().min(1).max(60).optional(),
        availableOnly: z.boolean().optional(),
        clearMoveIn: z.boolean().optional(),
        clearLease: z.boolean().optional(),
        resetExpenses: z.boolean().optional(),
        utilities: z.number().min(0).max(10000000).optional(),
        internet: z.number().min(0).max(10000000).optional(),
        transport: z.number().min(0).max(10000000).optional(),
        other: z.number().min(0).max(10000000).optional(),
        deposit: z.number().min(0).max(10000000).optional(),
        oneOff: z.number().min(0).max(10000000).optional(),
      }),
      execute: (input) =>
        run(() => {
          const { s, p } = current();
          const {
            moveIn,
            leaseMonths,
            availableOnly,
            clearMoveIn,
            clearLease,
            resetExpenses,
            ...expenses
          } = input;
          const next = {
            ...p,
            expenses: {
              ...(resetExpenses
                ? {
                    utilities: null,
                    internet: null,
                    transport: null,
                    other: null,
                    deposit: null,
                    oneOff: null,
                  }
                : p.expenses),
              ...expenses,
            },
            housing: {
              moveIn: clearMoveIn ? null : (moveIn ?? p.housing.moveIn),
              leaseMonths: clearLease
                ? null
                : (leaseMonths ?? p.housing.leaseMonths),
              availableOnly: availableOnly ?? p.housing.availableOnly,
            },
          };
          const found = reconcile({ ...s, student: next }),
            selected = found.find((l) => l.id === get().listingId);
          return {
            matchingListings: found.map((l) => ({ id: l.id, name: l.name })),
            currentApartment: selected
              ? { id: selected.id, name: selected.name }
              : null,
            cost: selected ? monthlyCost(selected, next) : null,
            housing: next.housing,
            inventory: "入住与可租状态为演示字段，非真实库存。",
          };
        }),
    }),
    setWeeklyDestinations: tool({
      description:
        "设置最多5个同城常用楼栋与每周到访次数（1–14），按每次往返计算各公寓每周总步行时间。必须使用已搜索到的楼栋ID。",
      inputSchema: z.object({
        destinations: studentPlanSchema.shape.destinations,
      }),
      execute: ({ destinations }) =>
        run(() => {
          const { s, p, listing } = current(),
            next = validateStudentPlan({ ...p, destinations }, s.cityId);
          update({ ...s, student: next });
          return {
            currentApartment: weeklyCommute(listing.id, next),
            allApartments: listings
              .filter((l) => l.cityId === s.cityId)
              .map((l) => ({ id: l.id, ...weeklyCommute(l.id, next) })),
            assumption:
              "每次到访按公寓与目的地之间往返计算，非按顺序串联的多站行程。",
          };
        }),
    }),
    planPublicTransport: tool({
      description:
        "规划当前公寓到已选楼栋的公共交通。伦敦查询TfL实际组合行程并显示地图；其他城市返回官方出行/校车来源与带起终点的外部规划链接，不能称本站已算出时长。",
      inputSchema: z.object({}),
      execute: () =>
        run(async () => {
          const { s, p, listing } = current(),
            b = buildingById(p.destinationId);
          if (!b) throw new Error("请先选择到校楼栋。");
          if (s.cityId !== "london")
            return {
              kind: "external-planner",
              ...transitSources[s.cityId],
              directionsUrl: transitDirectionsUrl(listing, b),
              limitation:
                "需在官方或外部规划页面查询，本站没有计算实时公交时长。",
            };
          let journeys: TransitJourney[];
          try {
            journeys = await getTransitJourneys(listing, b);
          } catch (e) {
            return {
              kind: "external-planner",
              ...transitSources[s.cityId],
              directionsUrl: transitDirectionsUrl(listing, b),
              reason:
                e instanceof SessionError && e.status === 429
                  ? "provider-rate-limit"
                  : "provider-unavailable",
              limitation:
                "TfL 当次查询不可用，本站没有算出公交时长。请使用返回的官方/外部行程入口，不声称地图已显示公交路线。",
            };
          }
          update({
            ...s,
            map: {
              ...s.map,
              campusRoute: false,
              routePlaceId: null,
              selectedPlaceId: null,
            },
            student: { ...p, transitRequested: true, routeBuilding: false },
          });
          return {
            kind: "tfl-journeys",
            source: "https://api.tfl.gov.uk/",
            journeys: journeys.map((j) => ({
              ...j,
              legs: j.legs.map(({ coordinates, ...leg }) => ({
                ...leg,
                geometryAvailable: coordinates.length > 1,
              })),
            })),
            timezone: "Europe/London",
            fetchedAt: new Date().toISOString(),
          };
        }),
    }),
  };
}
