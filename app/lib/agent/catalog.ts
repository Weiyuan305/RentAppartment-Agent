import { readAmenities, readCommute } from "@atlas/catalog-data";
import { cities, listings } from "../rental-data";
import type { CityAmenities } from "../amenities";
import type { WalkingRoute } from "../walking-route";
import { rentalStateSchema, type RentalState } from "./contract";
import { SessionError } from "./store";
import {validateStudentPlan} from "../student/planner";

const catalogs = new Map<string, CityAmenities>();
const routes = new Map<string, WalkingRoute>();
const placeIds = new Map<string, Set<string>>();
export function getAmenities(cityId: string) {
  const city = cities.find(c => c.id === cityId);
  if (!city) throw new Error("城市无效。");
  let data = catalogs.get(cityId);
  if (!data) {
    data = readAmenities(cityId);
    catalogs.set(cityId, data);
  }
  return data;
}
export function campusCommute(listingId: string) {
  const listing = listings.find(l => l.id === listingId);
  if (!listing) throw new Error("公寓无效。");
  let route = routes.get(listingId);
  if (!route) {
    route = readCommute(listingId);
    routes.set(listingId, route);
  }
  return route;
}
export function validateRentalState(input: unknown): RentalState {
  const state = rentalStateSchema.parse(input);
  try {state.student=validateStudentPlan(state.student,state.cityId);}catch {throw new SessionError("校园规划条件无效或不属于当前城市。",400);}
  if (!listings.some(l => l.id === state.listingId && l.cityId === state.cityId)) throw new SessionError("请选择本城公寓。", 400);
  let ids = placeIds.get(state.cityId);
  if (!ids) {ids = new Set(getAmenities(state.cityId).places.map(p => p.id)); placeIds.set(state.cityId, ids);}
  if ([...(state.map.placeIds ?? []), state.map.selectedPlaceId, state.map.routePlaceId].some(id => id && !ids.has(id))) throw new SessionError("地点不属于当前城市。", 400);
  if (state.map.routePlaceId && state.map.routePlaceId !== state.map.selectedPlaceId) throw new SessionError("路线目的地与所选地点不一致。", 400);
  return state;
}
