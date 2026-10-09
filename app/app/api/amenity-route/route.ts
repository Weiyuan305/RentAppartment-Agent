import { cities, listings } from "@/lib/rental-data";
import { parseCityAmenities } from "@/lib/amenities";
import { getAmenityRoute, RouteServiceError } from "@/lib/amenity-route-server";
import london from "@/public/amenities/london.json";
import sydney from "@/public/amenities/sydney.json";
import singapore from "@/public/amenities/singapore.json";
import kualaLumpur from "@/public/amenities/kuala-lumpur.json";
import hongKong from "@/public/amenities/hong-kong.json";

const snapshots: Record<string, unknown> = {london, sydney, singapore, "kuala-lumpur":kualaLumpur, "hong-kong":hongKong};
// Only existing sample listing/OSM IDs are accepted, never arbitrary coordinates or URLs.
const catalog: Map<string, Map<string, import("@/lib/amenities").Amenity>> = new Map(cities.map(city => [city.id, new Map(parseCityAmenities(snapshots[city.id], city).places.map(place => [place.id, place]))]));
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const cityId = params.get("city"), listingId = params.get("listing"), placeId = params.get("place");
  const listing = listings.find(l => l.id === listingId && l.cityId === cityId);
  const place = cityId && placeId ? catalog.get(cityId)?.get(placeId) : undefined;
  if (!listing || !place) return Response.json({error:"请选择同一城市中的演示公寓和有效地点。"}, {status:400,headers:{"Cache-Control":"no-store"}});
  try {
    return Response.json(await getAmenityRoute(listing, place), {headers:{"Cache-Control":"public, max-age=86400"}});
  } catch (e) {
    return Response.json({error:e instanceof RouteServiceError ? e.message : "路线服务暂时不可用。"}, {status:e instanceof RouteServiceError ? e.status : 502,headers:{"Cache-Control":"no-store",...(e instanceof RouteServiceError && e.status === 429 ? {"Retry-After":"5"} : {})}});
  }
}
