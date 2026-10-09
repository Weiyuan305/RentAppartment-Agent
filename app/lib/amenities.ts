import type { City } from "./rental-data";
import { metersBetween } from "./walking-route.ts";
import { studySpaceReferences } from "./study-space-references.ts";

export const amenityCategories = ["hospital", "convenience", "mall", "rail", "bus", "supermarket", "asian_grocery", "teaching", "library", "study", "pharmacy", "clinic", "restaurant", "cafe", "canteen", "gym", "sports", "park", "laundry", "printing", "parcel"] as const;
export type AmenityCategory = typeof amenityCategories[number];
export const primaryAmenityCategories: AmenityCategory[] = ["hospital", "convenience", "mall"];
export const amenityGroups: { name: string; categories: AmenityCategory[] }[] = [
  { name: "公共交通", categories: ["rail", "bus"] },
  { name: "买菜购物", categories: ["supermarket", "asian_grocery"] },
  { name: "校园学习", categories: ["teaching", "library", "study"] },
  { name: "日常医疗", categories: ["pharmacy", "clinic"] },
  { name: "吃饭喝咖啡", categories: ["restaurant", "cafe", "canteen"] },
  { name: "运动休闲", categories: ["gym", "sports", "park"] },
  { name: "生活服务", categories: ["laundry", "printing", "parcel"] },
];
export const amenityInfo = {
  hospital: { name: "医院", color: "#cf6273" },
  convenience: { name: "便利店", color: "#238d7a" },
  mall: { name: "商场", color: "#8862c1" },
  rail: { name: "地铁／铁路", color: "#4a73c7" }, bus: { name: "公交站", color: "#4a73c7" },
  supermarket: { name: "超市", color: "#238d7a" }, asian_grocery: { name: "亚洲食品店", color: "#238d7a" },
  teaching: { name: "大学建筑", color: "#8970b0" }, library: { name: "图书馆", color: "#8970b0" }, study: { name: "自习空间", color: "#8970b0" },
  pharmacy: { name: "药店", color: "#cf6273" }, clinic: { name: "诊所", color: "#cf6273" },
  restaurant: { name: "餐厅", color: "#b47a3f" }, cafe: { name: "咖啡店", color: "#b47a3f" }, canteen: { name: "食堂／美食广场", color: "#b47a3f" },
  gym: { name: "健身房", color: "#548e66" }, sports: { name: "球场／运动场", color: "#548e66" }, park: { name: "公园", color: "#548e66" },
  laundry: { name: "洗衣店", color: "#608a9f" }, printing: { name: "打印店", color: "#608a9f" }, parcel: { name: "快递收寄", color: "#608a9f" },
} as const;
export const amenityTagKeys = ["amenity", "healthcare", "shop", "railway", "station", "public_transport", "highway", "building", "education", "leisure", "sport", "cuisine", "origin", "access", "opening_hours", "operator", "brand", "ref", "network", "route_ref", "service:print", "service:copy", "post_office", "parcel_pickup", "parcel_mail_in"] as const;
export const amenityOverpassEndpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
export type Amenity = {
  id: string; category: AmenityCategory; name: string; lng: number; lat: number;
  locationType: "node" | "area-center"; address?: string;
  studySource?: string;
  tags: Partial<Record<typeof amenityTagKeys[number], string>>;
};
export type CityAmenities = {
  version: 1 | 2; cityId: string; center: [number, number]; radiusMeters: 3000; places: Amenity[];
  source: { provider: "OpenStreetMap"; endpoint: string; collectedAt: string; osmBase: string };
};
export function amenitySourceUrl(place: Amenity) { return `https://www.openstreetmap.org/${place.id}`; }
export function amenityCuisines(value: string | undefined) { return value?.split(";").map(c => c.trim().toLowerCase()).filter(Boolean) ?? []; }
export function categoryFromTags(tags: Record<string, unknown>): AmenityCategory | null {
  if (tags.amenity === "hospital" || tags.healthcare === "hospital") return "hospital";
  if (tags.shop === "mall") return "mall";
  const groceries = ["supermarket", "convenience", "grocery", "food"].includes(String(tags.shop));
  if (groceries && /^(asian|chinese|japanese|korean|thai|vietnamese|filipino|indian|malaysian|singaporean|indonesian)(;|$)/i.test(String(tags.origin || tags.cuisine || ""))) return "asian_grocery";
  if (tags.shop === "convenience") return "convenience";
  if (tags.shop === "supermarket") return "supermarket";
  if (["station", "halt", "tram_stop", "subway_entrance"].includes(String(tags.railway)) || tags.public_transport === "station") return "rail";
  if (tags.highway === "bus_stop" || tags.amenity === "bus_station") return "bus";
  if (tags.amenity === "library") return "library";
  if (["study_space", "study_area"].includes(String(tags.amenity))) return "study";
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (["clinic", "doctors"].includes(String(tags.amenity)) || ["clinic", "doctor"].includes(String(tags.healthcare))) return "clinic";
  if (["restaurant", "fast_food"].includes(String(tags.amenity))) return "restaurant";
  if (tags.amenity === "cafe") return "cafe";
  if (["canteen", "food_court"].includes(String(tags.amenity))) return "canteen";
  if (tags.leisure === "fitness_centre") return "gym";
  if (["pitch", "sports_centre", "track"].includes(String(tags.leisure))) return "sports";
  if (tags.leisure === "park") return "park";
  if (["laundry", "dry_cleaning"].includes(String(tags.shop))) return "laundry";
  if (["copyshop", "printing"].includes(String(tags.shop))) return "printing";
  if (["post_office", "parcel_locker", "parcel_pickup", "post_depot"].includes(String(tags.amenity)) || tags.shop === "courier") return "parcel";
  if (["university", "college"].includes(String(tags.building)) || ["university", "college"].includes(String(tags.amenity)) || tags.education === "university") return "teaching";
  return null;
}
export function matchesAmenityCategory(place: Amenity, category: AmenityCategory) {
  return place.category === category || (category === "study" && Boolean(place.studySource)) || (place.category === "asian_grocery" && ((category === "supermarket" && place.tags.shop === "supermarket") || (category === "convenience" && place.tags.shop === "convenience")));
}
export function parseCityAmenities(value: unknown, city: City): CityAmenities {
  const data = value as CityAmenities;
  if (![1, 2].includes(data?.version) || data.cityId !== city.id || data.radiusMeters !== 3000
    || !Array.isArray(data.center) || data.center[0] !== city.lng || data.center[1] !== city.lat
    || data.source?.provider !== "OpenStreetMap" || !amenityOverpassEndpoints.includes(data.source.endpoint)
    || !Number.isFinite(Date.parse(data.source.collectedAt)) || !Number.isFinite(Date.parse(data.source.osmBase))
    || !Array.isArray(data.places) || data.places.length > 15000) throw new Error("Invalid amenity collection");
  const seen = new Set<string>();
  for (const place of data.places) {
    const official = studySpaceReferences[place?.id];
    if (!place || typeof place.id !== "string" || !/^(node|way|relation)\/\d+$/.test(place.id) || seen.has(place.id)
      || !amenityCategories.includes(place.category) || !place.tags || (official?.cityId === city.id ? official.category ?? categoryFromTags(place.tags) : categoryFromTags(place.tags)) !== place.category
      || (place.studySource !== undefined && (official?.cityId !== city.id || place.studySource !== official.url))
      || !Object.entries(place.tags).every(([k, v]) => amenityTagKeys.includes(k as typeof amenityTagKeys[number]) && typeof v === "string" && v.length <= 1000)
      || typeof place.name !== "string" || !place.name.trim() || place.name.length > 300
      || !Number.isFinite(place.lng) || !Number.isFinite(place.lat) || Math.abs(place.lng) > 180 || Math.abs(place.lat) > 90
      || metersBetween(data.center, [place.lng, place.lat]) > 3001
      || place.locationType !== (place.id.startsWith("node/") ? "node" : "area-center")
      || (place.address !== undefined && (typeof place.address !== "string" || place.address.length > 500))) throw new Error("Invalid amenity record");
    seen.add(place.id);
  }
  return data;
}
