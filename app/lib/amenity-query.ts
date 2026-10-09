import { amenityCuisines, matchesAmenityCategory, type Amenity, type AmenityCategory, type CityAmenities } from "./amenities";
import { metersBetween } from "./walking-route";

export type AmenitySelection = {
  categories: AmenityCategory[];
  radiusMeters: number;
  cuisine: string;
  placeIds: string[] | null;
};
// Shared by the server tools and Cesium: the count and markers use this exact set.
export function selectAmenities(data: CityAmenities | null, origin: [number, number], selection: AmenitySelection): Amenity[] {
  const ids = selection.placeIds ? new Set(selection.placeIds) : null;
  return (data?.places ?? []).filter(p => selection.categories.some(c => matchesAmenityCategory(p, c))
    && (!selection.radiusMeters || metersBetween(origin, [p.lng, p.lat]) <= selection.radiusMeters)
    && (!selection.cuisine || !["restaurant", "cafe", "canteen"].includes(p.category) || amenityCuisines(p.tags.cuisine).includes(selection.cuisine))
    && (!ids || ids.has(p.id)))
    .map(place => ({place, distance: metersBetween(origin, [place.lng, place.lat])}))
    .sort((a, b) => a.distance - b.distance || a.place.id.localeCompare(b.place.id)).map(p => p.place);
}
