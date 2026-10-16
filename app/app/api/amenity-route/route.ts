import { getPublicCatalogue } from "@/lib/merchant/server";
import { cities } from "@/lib/rental-data";
import { getAmenityRoute, RouteServiceError } from "@/lib/amenity-route-server";
import { getAmenities } from "@/lib/agent/catalog";

// Accept only catalog IDs; callers cannot proxy arbitrary coordinates or URLs.
export async function GET(request: Request) {
  const listings=await getPublicCatalogue();
  const params = new URL(request.url).searchParams;
  const cityId = params.get("city"), listingId = params.get("listing"), placeId = params.get("place");
  const listing = listings.find(l => l.id === listingId && l.cityId === cityId);
  const place = cityId && placeId && cities.some(c => c.id === cityId) ? getAmenities(cityId).places.find(p => p.id === placeId) : undefined;
  if (!listing || !place) return Response.json({error:"请选择同一城市中的演示公寓和有效地点。"}, {status:400,headers:{"Cache-Control":"no-store"}});
  try {
    return Response.json(await getAmenityRoute(listing, place), {headers:{"Cache-Control":"public, max-age=86400"}});
  } catch (e) {
    return Response.json({error:e instanceof RouteServiceError ? e.message : "路线服务暂时不可用。"}, {status:e instanceof RouteServiceError ? e.status : 502,headers:{"Cache-Control":"no-store",...(e instanceof RouteServiceError && e.status === 429 ? {"Retry-After":"5"} : {})}});
  }
}
