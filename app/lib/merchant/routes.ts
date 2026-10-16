import { getCity, type Listing } from "../rental-data";
import { getAmenityRoute } from "../amenity-route-server";
import { buildingById } from "../student/catalog";
import type { Amenity } from "../amenities";
export async function merchantWalkingRoute(
  listing: Listing,
  buildingId?: string | null,
) {
  const b = buildingById(buildingId),
    city = getCity(listing.cityId);
  if (buildingId && (!b || b.cityId !== listing.cityId))
    throw new Error("Invalid building");
  const target = {
    id: b?.id ?? `university:${city.id}`,
    lng: b?.lng ?? city.lng,
    lat: b?.lat ?? city.lat,
  } as Amenity;
  const route = await getAmenityRoute(listing, target);
  return { ...route, ...(b ? { buildingId: b.id } : {}) };
}
