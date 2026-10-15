import { amenityInfo, type CityAmenities, type Amenity } from "./amenities";
import { displayArea, displayCity, translator, type Locale } from "./i18n";
import type { City, Listing } from "./rental-data";
import { buildingsInCity, type CampusBuilding } from "./student/catalog";
import { metersBetween } from "./walking-route";

type Place = { id: string; name: string; detail: string; keywords: string; lng: number; lat: number };
export type MapSearchResult = Place & (
  | { kind: "home"; home: Listing }
  | { kind: "building"; building: CampusBuilding }
  | { kind: "amenity"; amenity: Amenity }
  | { kind: "campus" }
);
const english = translator("en");
const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Only index this city's catalog and the homes allowed by the current filters.
export function mapSearchIndex(city: City, homes: Listing[], amenities: CityAmenities | null, locale: Locale): MapSearchResult[] {
  const view = displayCity(city, locale), en = displayCity(city, "en");
  return [
    ...homes.filter(home => home.cityId === city.id).map(home => ({
      kind: "home" as const, id: home.id, name: home.name, detail: displayArea(home.area, locale), lng: home.lng, lat: home.lat, home,
      keywords: `${home.name} ${home.area} ${displayArea(home.area, "en")} ${home.roomType} 房源 公寓 home apartment`,
    })),
    {kind: "campus", id: city.id, name: view.university, detail: view.campus, lng: city.lng, lat: city.lat,
      keywords: `${city.university} ${city.campus} ${en.university} ${en.campus} 大学 校园 university campus`},
    ...buildingsInCity(city.id).map(building => ({
      kind: "building" as const, id: building.id, name: building.name, detail: locale === "zh" ? "校园楼栋 · 可设为通勤目的地" : "Campus building · Set as destination", lng: building.lng, lat: building.lat, building,
      keywords: `${building.name} ${building.aliases.join(" ")} 校园 楼栋 building ${building.category}`,
    })),
    ...(amenities?.cityId === city.id ? amenities.places : []).map(amenity => ({
      kind: "amenity" as const, id: amenity.id, name: amenity.name, detail: `${locale === "zh" ? amenityInfo[amenity.category].name : english(amenityInfo[amenity.category].name)}${amenity.address ? ` · ${amenity.address}` : locale === "zh" ? " · 地址未收录" : " · Address not recorded"}`, lng: amenity.lng, lat: amenity.lat, amenity,
      keywords: `${amenity.name} ${amenity.address ?? ""} ${amenityInfo[amenity.category].name} ${english(amenityInfo[amenity.category].name)} ${amenity.category}`,
    })),
  ];
}

export function searchMapPlaces(index: MapSearchResult[], query: string, origin: [number, number], limit = 10) {
  const needle = normalize(query), tokens = needle.split(" ");
  if (!needle) return { results: query.trim() ? [] : index.filter(item => item.kind !== "amenity").slice(0, 8), total: 0 };
  const matches = index.flatMap(item => {
    const name = normalize(item.name), words = normalize(item.keywords);
    if (!tokens.every(token => words.includes(token))) return [];
    const unnamed = item.name.startsWith("未命名");
    const categoryQuery = item.kind === "amenity" && [amenityInfo[item.amenity.category].name, english(amenityInfo[item.amenity.category].name), item.amenity.category]
      .some(label => normalize(label) === needle || normalize(label).replace(/s$/, "") === needle);
    return [{ item, rank: unnamed ? 4 : categoryQuery ? 3 : name === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2 : 3,
      distance: metersBetween(origin, [item.lng, item.lat]) }];
  }).sort((a, b) => a.rank - b.rank || a.distance - b.distance || a.item.id.localeCompare(b.item.id));
  // A campus building can also be in the OSM amenities file. Offer its richer destination action once.
  const buildings = new Set(matches.filter(({item}) => item.kind === "building").map(({item}) => item.id));
  const seen = new Set<string>();
  const unique = matches.filter(({item}) => {
    if (item.kind === "amenity" && buildings.has(item.id)) return false;
    const key = item.kind === "building" || item.kind === "amenity" ? item.id : `${item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  return { results: unique.slice(0, limit).map(match => match.item), total: unique.length };
}
