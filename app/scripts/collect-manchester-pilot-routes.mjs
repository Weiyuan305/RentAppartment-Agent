// Fetch missing Valhalla routes for the Manchester pilot homes only.
// Does not rewrite existing route files, catchments, or unrelated commute indexes.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { listings, getCity } from "../lib/rental-data.ts";
import { decodePolyline, metersBetween, parseWalkingRoute } from "../lib/walking-route.ts";

const ids = ["manchester-7", "manchester-8", "manchester-9", "manchester-10"];
const endpoint = "https://valhalla1.openstreetmap.de/route";
const homes = listings.filter(listing => ids.includes(listing.id));
if (homes.length !== ids.length) throw new Error("Manchester pilot listings are missing");

async function valhalla(origin, destination) {
  await new Promise(done => setTimeout(done, 1100));
  const request = {
    locations: [
      { lat: origin.lat, lon: origin.lng, search_cutoff: 250 },
      { lat: destination.lat, lon: destination.lng, search_cutoff: 250 },
    ],
    costing: "pedestrian",
    costing_options: { pedestrian: { walking_speed: 5.1 } },
    units: "kilometers",
    language: "en-US",
  };
  const raw = execFileSync("curl", [
    "--fail", "--silent", "--show-error", "--location", "--max-time", "25", "--get", endpoint,
    "--header", "X-Client-Id: campus-atlas-rental-validation",
    "--data-urlencode", `json=${JSON.stringify(request)}`,
  ], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
  return JSON.parse(raw);
}

function routeFrom(payload, listing, destination, extra = {}) {
  if (payload.trip?.status !== 0 || payload.trip?.legs?.length !== 1) throw new Error(`No walking route for ${listing.id}`);
  const leg = payload.trip.legs[0];
  const coordinates = decodePolyline(leg.shape);
  const origin = [listing.lng, listing.lat];
  const dest = [destination.lng, destination.lat];
  return {
    version: 1,
    listingId: listing.id,
    cityId: listing.cityId,
    mode: "pedestrian",
    origin,
    destination: dest,
    coordinates,
    distanceMeters: Math.round(payload.trip.summary.length * 1000),
    durationSeconds: payload.trip.summary.time,
    startOffsetMeters: Math.round(metersBetween(origin, coordinates[0])),
    endOffsetMeters: Math.round(metersBetween(dest, coordinates.at(-1))),
    steps: leg.maneuvers.map(step => ({
      instruction: step.instruction,
      distanceMeters: Math.round(step.length * 1000),
      begin: step.begin_shape_index,
      end: step.end_shape_index,
    })),
    source: { engine: "Valhalla", network: "OpenStreetMap", endpoint, calculatedAt: new Date().toISOString(), walkingSpeedKmh: 5.1 },
    ...extra,
  };
}

const campusBlocks = [];
for (const listing of homes) {
  const city = getCity(listing.cityId);
  const path = `public/routes/${listing.id}.json`;
  let route;
  if (existsSync(path)) route = JSON.parse(readFileSync(path, "utf8"));
  else {
    route = routeFrom(await valhalla(listing, city), listing, city);
    parseWalkingRoute(route, listing, city);
    writeFileSync(path, JSON.stringify(route) + "\n");
    console.log(`${listing.id}: ${route.distanceMeters} m / ${Math.ceil(route.durationSeconds / 60)} min`);
  }
  parseWalkingRoute(route, listing, city);
  campusBlocks.push(`  "${listing.id}": {\n    "durationSeconds": ${route.durationSeconds},\n    "distanceMeters": ${route.distanceMeters}\n  }`);
}

const commutePath = "lib/campus-commutes.json";
let commuteText = readFileSync(commutePath, "utf8");
if (!commuteText.includes('"manchester-7"')) {
  commuteText = commuteText.replace('  "melbourne-1":', `${campusBlocks.join(",\n")},\n  "melbourne-1":`);
  writeFileSync(commutePath, commuteText);
}

const buildings = JSON.parse(readFileSync("lib/student/data/campuses.json", "utf8")).buildings.filter(building => building.cityId === "manchester");
const summaries = [];
for (const listing of homes) {
  for (const building of buildings) {
    const folder = `public/campus-routes/${listing.id}`;
    mkdirSync(folder, { recursive: true });
    const path = `${folder}/${building.id.replace("/", "-")}.json`;
    let route;
    if (existsSync(path)) route = JSON.parse(readFileSync(path, "utf8"));
    else {
      route = routeFrom(await valhalla(listing, building), listing, building, { buildingId: building.id });
      parseWalkingRoute(route, listing, { ...getCity(listing.cityId), lng: building.lng, lat: building.lat });
      writeFileSync(path, JSON.stringify(route) + "\n");
      console.log(`${listing.id} -> ${building.name}: ${route.distanceMeters} m`);
    }
    summaries.push({
      key: `${listing.id}:${building.id}`,
      value: {
        listingId: listing.id,
        buildingId: building.id,
        cityId: listing.cityId,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        startOffsetMeters: route.startOffsetMeters,
        endOffsetMeters: route.endOffsetMeters,
        source: route.source,
      },
    });
  }
}

const routesPath = "lib/student/data/routes.json";
let routesText = readFileSync(routesPath, "utf8");
const missing = summaries.filter(item => !routesText.includes(`"${item.key}"`));
if (missing.length) {
  const addition = missing.map(item => `${JSON.stringify(item.key)}:${JSON.stringify(item.value)}`).join(",");
  routesText = routesText.trimEnd().replace(/}\s*$/, `,${addition}}`);
  writeFileSync(routesPath, routesText.endsWith("\n") ? routesText : routesText + "\n");
}
console.log(`Manchester pilot routes ready: ${homes.length} campus, ${summaries.length} buildings`);
