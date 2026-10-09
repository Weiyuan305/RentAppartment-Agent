import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cities, listings, getCity } from "../rental-data";
import { parseCityAmenities, type CityAmenities } from "../amenities";
import { parseWalkingRoute, type WalkingRoute } from "../walking-route";
import { rentalStateSchema, type RentalState } from "./contract";
import { SessionError } from "./store";

const catalogs = new Map<string, CityAmenities>();
const routes = new Map<string, WalkingRoute>();
export function getAmenities(cityId: string) {
  const city = cities.find(c => c.id === cityId);
  if (!city) throw new Error("城市无效。");
  let data = catalogs.get(cityId);
  if (!data) {
    data = parseCityAmenities(JSON.parse(readFileSync(resolve(process.cwd(), `public/amenities/${cityId}.json`), "utf8")), city);
    catalogs.set(cityId, data);
  }
  return data;
}
export function campusCommute(listingId: string) {
  const listing = listings.find(l => l.id === listingId);
  if (!listing) throw new Error("公寓无效。");
  let route = routes.get(listingId);
  if (!route) {
    route = parseWalkingRoute(JSON.parse(readFileSync(resolve(process.cwd(), `public/routes/${listingId}.json`), "utf8")), listing, getCity(listing.cityId));
    routes.set(listingId, route);
  }
  return route;
}
export function validateRentalState(input: unknown): RentalState {
  const state = rentalStateSchema.parse(input);
  if (!listings.some(l => l.id === state.listingId && l.cityId === state.cityId)) throw new SessionError("请选择本城公寓。", 400);
  const places = getAmenities(state.cityId).places;
  const ids = new Set(places.map(p => p.id));
  if ([...(state.map.placeIds ?? []), state.map.selectedPlaceId, state.map.routePlaceId].some(id => id && !ids.has(id))) throw new SessionError("地点不属于当前城市。", 400);
  if (state.map.routePlaceId && state.map.routePlaceId !== state.map.selectedPlaceId) throw new SessionError("路线目的地与所选地点不一致。", 400);
  return state;
}
