import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getCity, listings } from "../rental-data";
import { parseCityAmenities } from "../amenities";
import { parseWalkingRoute } from "../walking-route";

export function readAmenities(cityId: string) {
  return parseCityAmenities(JSON.parse(readFileSync(resolve(process.cwd(), `public/amenities/${cityId}.json`), "utf8")), getCity(cityId));
}
export function readCommute(listingId: string) {
  const listing = listings.find(l => l.id === listingId)!;
  return parseWalkingRoute(JSON.parse(readFileSync(resolve(process.cwd(), `public/routes/${listingId}.json`), "utf8")), listing, getCity(listing.cityId));
}
