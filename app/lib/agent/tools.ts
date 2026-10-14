import { tool } from "ai";
import {createStudentTools} from "../student/tools";
import {normalizedStudentPlan} from "../student/state";
import {buildingCommute,buildingById} from "../student/catalog";
import { z } from "zod";
import { amenityCategories, amenityInfo } from "../amenities";
import { selectAmenities } from "../amenity-query";
import { emptyFilters, matchesFilters } from "../assistant";
import { getCity, listings } from "../rental-data";
import { metersBetween, routeMinutes } from "../walking-route";
import { getAmenityRoute } from "../amenity-route-server";
import { campusCommute, getAmenities, validateRentalState } from "./catalog";
import { emptyMapSelection, filtersSchema, type RentalState } from "./contract";

export function createRentalTools(initial: RentalState, onState: (state: RentalState) => void = () => {}) {
  let state = validateRentalState(initial), calls = 0;
  // Serialize even providers that ignore parallel_tool_calls=false.
  let queue: Promise<unknown> = Promise.resolve();
  function run<T>(operation: () => Promise<T> | T): Promise<T> {
    if (++calls > 8) return Promise.reject(new Error("本轮工具调用已达上限，请缩小问题范围。"));
    const task = queue.then(operation); queue = task.catch(() => {}); return task;
  }
  function update(next: RentalState) {state = validateRentalState(next); onState(state);}
  function stopStudentRoutes(){return {...normalizedStudentPlan(state.student),routeBuilding:false,transitRequested:false};}
  function listing() {
    const current = listings.find(l => l.id === state.listingId && l.cityId === state.cityId)!;
    if (!matchesFilters(current, state.filters,state.student)) throw new Error("当前筛选没有选中的公寓，请先调整房源条件。");
    return current;
  }
  function visible() {const l = listing(); return selectAmenities(getAmenities(state.cityId), [l.lng, l.lat], state.map);}
  const tools = {
    searchListings: tool({
      description: "根据预算、房型、账单及到当前大学的真实步行时间筛选演示公寓，同步列表和地图。只传想更新的条件；clearBudget=true清除预算，clearWalkMinutes=true清除通勤时间，reset=true清除全部条件。budgetPeriod填写用户说的周/月单位；程序按52周/12月换算，默认当前城市租期。不自动换币。安全没有评分数据。",
      // Use explicit clear flags: some OpenAI-compatible gateways reject nullable
      // numeric anyOf schemas even when the requested tool is a different one.
      inputSchema: filtersSchema.partial().omit({budget: true, walkMinutes: true}).extend({
        budget: filtersSchema.shape.budget.unwrap().optional(), walkMinutes: filtersSchema.shape.walkMinutes.unwrap().optional(),
        clearBudget: z.boolean().optional(), clearWalkMinutes: z.boolean().optional(),
        reset: z.boolean().optional(), budgetPeriod: z.enum(["current", "week", "month"]).optional(),
      }),
      execute: input => run(() => {
        const {reset, budgetPeriod, clearBudget, clearWalkMinutes, ...patch} = input;
        const city = getCity(state.cityId);
        const inputPeriod = budgetPeriod === "week" ? "周" : budgetPeriod === "month" ? "月" : city.period;
        if (patch.budget && inputPeriod !== city.period) patch.budget = Math.round(patch.budget * (inputPeriod === "月" ? 12 / 52 : 52 / 12) * 100) / 100;
        const filters = {...(reset ? emptyFilters : state.filters), ...patch,
          ...(clearBudget ? {budget: null} : {}), ...(clearWalkMinutes ? {walkMinutes: null} : {})};
        const found = listings.filter(l => l.cityId === state.cityId && matchesFilters(l, filters,state.student));
        const id = found.some(l => l.id === state.listingId) ? state.listingId : found[0]?.id ?? state.listingId;
        update({...state, filters, listingId: id, student:found.length && id===state.listingId?state.student:stopStudentRoutes(),map: found.length && id === state.listingId ? state.map : emptyMapSelection()});
        return {count: found.length, currency: city.currency, period: city.period, budget: filters.budget, conversion: inputPeriod !== city.period ? "按52周/12月折算" : null, listings: found.map(l => ({id: l.id, name: l.name, price: l.price, roomType: l.roomType, bills: l.bills, campusWalkMinutes: routeMinutes((state.student?.destinationId?buildingCommute(l.id,state.student.destinationId):campusCommute(l.id))?.durationSeconds ?? Number.POSITIVE_INFINITY), destination:buildingById(state.student?.destinationId)?.name ?? city.university})), safety: "缺少可靠数据，不能判断安全或打分", inventory: "虚构演示房源，不可预订"};
      }),
    }),
    selectListing: tool({
      description: "选择同城演示公寓作为附近查询和路线的起点。必须使用房源查询返回的真实 ID。",
      inputSchema: z.object({listingId: z.string().max(50)}),
      execute: ({listingId}) => run(() => {
        const found = listings.find(l => l.id === listingId && l.cityId === state.cityId && matchesFilters(l, state.filters,state.student));
        if (!found) throw new Error("该公寓不在当前城市或不满足已选条件。");
        update({...state, listingId,student:stopStudentRoutes(), map: emptyMapSelection()}); return {listingId, name: found.name};
      }),
    }),
    findNearbyAmenities: tool({
      description: "以当前选中公寓为中心查询设施，并同步地图。radiusMeters 是直线半径，不是步行距离；省略时沿用前次范围，否则默认500米。返回完整收录数及最近10个候选，地图显示全部匹配记录。快照仅覆盖大学周边3公里，缺漏或范围外未知不等于零。",
      inputSchema: z.object({category: z.enum(amenityCategories), radiusMeters: z.number().int().min(100).max(2000).optional(), cuisine: z.string().max(80).optional()}),
      execute: ({category, radiusMeters, cuisine}) => run(() => {
        const l = listing(), data = getAmenities(state.cityId), radius = radiusMeters ?? (state.map.radiusMeters || 500);
        const map = {...emptyMapSelection(), categories: [category], radiusMeters: radius, cuisine: cuisine ?? ""};
        const found = selectAmenities(data, [l.lng, l.lat], map);
        update({...state,student:stopStudentRoutes(), map});
        return {count: found.length, category: amenityInfo[category].name, center: {id: l.id, name: l.name}, radiusMeters: radius, distanceType: "直线", coverageComplete: metersBetween(data.center, [l.lng, l.lat]) + radius <= data.radiusMeters, candidates: found.slice(0, 10).map(p => ({id: p.id, name: p.name, straightLineMeters: Math.round(metersBetween([l.lng, l.lat], [p.lng, p.lat]))})), source: data.source, limitation: "统计为快照收录数，非全部门店或实时营业状态。最近候选不等于步行最近。地图使用相同查询结果。"};
      }),
    }),
    focusAmenity: tool({
      description: "在上次附近查询的结果中只显示一个地点。省略 placeId 则选择直线最近的一处。不能将直线最近说成步行最近。",
      inputSchema: z.object({placeId: z.string().max(70).optional()}),
      execute: ({placeId}) => run(() => {
        const found = visible(), place = placeId ? found.find(p => p.id === placeId) : found[0];
        if (!place) throw new Error("当前没有匹配地点，请先查询附近设施。");
        update({...state,student:stopStudentRoutes(), map: {...state.map, placeIds: [place.id], selectedPlaceId: place.id, routePlaceId: null, campusRoute: false}});
        const l = listing(); return {id: place.id, name: place.name, displayedCount: 1, straightLineMeters: Math.round(metersBetween([l.lng, l.lat], [place.lng, place.lat])), limitation: "直线距离，不是步行距离"};
      }),
    }),
    planWalkingRoute: tool({
      description: "计算当前公寓到所选设施的真实步行路网，或展示已有的到当前大学的步行路线。没有选中设施时先调用 focusAmenity。只返回路线摘要，地图画真实路线。失败时不能编造路线和时间。",
      inputSchema: z.object({destination: z.enum(["selected-place", "campus"])}),
      execute: ({destination}) => run(async () => {
        const l = listing();
        if (destination === "campus") {
          const building=buildingById(state.student?.destinationId),buildingRoute=buildingCommute(l.id,building?.id);
          if(building&&buildingRoute){
            update({...state,student:{...normalizedStudentPlan(state.student),routeBuilding:true,transitRequested:false},map:{...state.map,campusRoute:false,routePlaceId:null,selectedPlaceId:null}});
            return {destination:building.name,distanceMeters:buildingRoute.distanceMeters,minutes:routeMinutes(buildingRoute.durationSeconds),source:buildingRoute.source,limitation:"路网估计，演示公寓位置，楼栋入口/开放条件未核验"};
          }
          const route = campusCommute(l.id);
          update({...state,student:stopStudentRoutes(), map: {...state.map, routePlaceId: null, selectedPlaceId: null, campusRoute: true}});
          return {destination: getCity(state.cityId).university, distanceMeters: route.distanceMeters, minutes: routeMinutes(route.durationSeconds), source: route.source, limitation: "路网估计，演示公寓位置，入口偏移未计入时间"};
        }
        const place = visible().find(p => p.id === state.map.selectedPlaceId);
        if (!place) throw new Error("请先选择附近查询中的一个地点。");
        const route = await getAmenityRoute(l, place);
        update({...state,student:stopStudentRoutes(), map: {...state.map, routePlaceId: place.id, campusRoute: false}});
        return {destination: place.name, distanceMeters: route.distanceMeters, minutes: routeMinutes(route.durationSeconds), startOffsetMeters: route.startOffsetMeters, endOffsetMeters: route.endOffsetMeters, source: route.source, limitation: "真实路网估计，非实时导航；公寓与场所入口待核验，入口偏移未计入时间"};
      }),
    }),
  };
  return {tools:{...tools,...createStudentTools(()=>state,update,run)}, getState: () => state};
}
