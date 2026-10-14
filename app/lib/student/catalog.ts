import data from "./data/campuses.json";
import routes from "./data/routes.json";
import type { CityId } from "../rental-data";
import type { WalkingRoute } from "../walking-route";

export type BuildingCategory = "teaching" | "library" | "services" | "dining";
export type CampusBuilding = {
  id: string;
  cityId: CityId;
  campusId: string;
  name: string;
  aliases: string[];
  category: BuildingCategory;
  lng: number;
  lat: number;
  locationType: "building-center" | "mapped-entrance";
  source: { url: string; officialUrl: string; collectedAt: string };
};
export type Campus = {
  id: string;
  cityId: CityId;
  university: string;
  name: string;
  officialUrl: string;
};
export type CampusRoute = WalkingRoute & { buildingId: string };
export type CampusCommute = Pick<
  CampusRoute,
  | "listingId"
  | "buildingId"
  | "cityId"
  | "distanceMeters"
  | "durationSeconds"
  | "startOffsetMeters"
  | "endOffsetMeters"
  | "source"
>;
export type Catchment = {
  buildingId: string;
  minutes: 10 | 20 | 30;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  source: {
    endpoint: string;
    calculatedAt: string;
    reverse: true;
    walkingSpeedKmh: 5.1;
  };
};
export const campuses = data.campuses as Campus[];
export const campusBuildings = data.buildings as CampusBuilding[];
const routeIndex = routes as unknown as Record<string, CampusCommute>;
export function buildingById(id: string | null | undefined) {
  return campusBuildings.find((b) => b.id === id);
}
export function buildingsInCity(cityId: string) {
  return campusBuildings.filter((b) => b.cityId === cityId);
}
export function buildingCommute(
  listingId: string,
  buildingId: string | null | undefined,
) {
  return buildingId ? routeIndex[`${listingId}:${buildingId}`] : undefined;
}
export function buildingRouteUrl(listingId: string, buildingId: string) {
  return `/campus-routes/${encodeURIComponent(listingId)}/${buildingId.replace("/", "-")}.json`;
}
export function searchBuildings(
  cityId: string,
  query: string,
  campusId?: string | null,
) {
  const q = query.trim().normalize("NFKC").toLocaleLowerCase();
  return buildingsInCity(cityId).filter(
    (b) =>
      (!campusId || b.campusId === campusId) &&
      (!q ||
        [b.name, ...b.aliases].some((n) =>
          n.normalize("NFKC").toLocaleLowerCase().includes(q),
        )),
  );
}
