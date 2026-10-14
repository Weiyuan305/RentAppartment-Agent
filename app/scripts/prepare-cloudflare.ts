import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cities, getCity, listings } from "../lib/rental-data";
import { parseCityAmenities } from "../lib/amenities";
import { parseWalkingRoute } from "../lib/walking-route";

// Validate trusted snapshots at build time. Workers have no persistent local
// filesystem, and needn't revalidate every city on a 10 ms CPU request budget.
const amenities = Object.fromEntries(cities.map(city => [city.id, parseCityAmenities(JSON.parse(readFileSync(`public/amenities/${city.id}.json`, "utf8")), city)]));
const commutes = Object.fromEntries(listings.map(listing => [listing.id, parseWalkingRoute(JSON.parse(readFileSync(`public/routes/${listing.id}.json`, "utf8")), listing, getCity(listing.cityId))]));
mkdirSync(".generated", {recursive: true});
writeFileSync(".generated/amenities.json", JSON.stringify(amenities));
writeFileSync(".generated/commutes.json", JSON.stringify(commutes));
writeFileSync(".generated/catalog-data.ts", `// Generated from validated public snapshots by prepare-cloudflare.ts.
import amenities from "./amenities.json";
import commutes from "./commutes.json";
import type {CityAmenities} from "../lib/amenities";
import type {WalkingRoute} from "../lib/walking-route";
export function readAmenities(cityId: string): CityAmenities {return (amenities as unknown as Record<string, CityAmenities>)[cityId];}
export function readCommute(listingId: string): WalkingRoute {return (commutes as unknown as Record<string, WalkingRoute>)[listingId];}
`);
console.log(`Cloudflare catalog: ${cities.length} validated cities, ${listings.length} validated campus routes.`);
