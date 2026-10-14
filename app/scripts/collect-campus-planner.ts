import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { listings, getCity } from "../lib/rental-data";
import {
  decodePolyline,
  metersBetween,
  parseWalkingRoute,
} from "../lib/walking-route";
const data = JSON.parse(readFileSync("lib/student/data/campuses.json", "utf8"));
const summaries: Record<string, unknown> = {},
  catchments: Record<string, unknown> = {};
const endpoint = "https://valhalla1.openstreetmap.de";
function saveIndex() {
  writeFileSync(
    "lib/student/data/routes.json",
    JSON.stringify(summaries) + "\n",
  );
  writeFileSync(
    "lib/student/data/catchments.json",
    JSON.stringify(catchments) + "\n",
  );
}
saveIndex();
async function query(kind: string, request: unknown) {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const raw = execFileSync(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--max-time",
      "25",
      "--get",
      `${endpoint}/${kind}`,
      "--header",
      "X-Client-Id: campus-atlas-student-validation",
      "--data-urlencode",
      `json=${JSON.stringify(request)}`,
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  return JSON.parse(raw);
}
for (const b of data.buildings) {
  for (const l of listings.filter((l) => l.cityId === b.cityId)) {
    const folder = `public/campus-routes/${l.id}`;
    mkdirSync(folder, { recursive: true });
    const path = `${folder}/${b.id.replace("/", "-")}.json`;
    let r;
    if (existsSync(path)) r = JSON.parse(readFileSync(path, "utf8"));
    else {
      const result = await query("route", {
        locations: [
          { lat: l.lat, lon: l.lng, search_cutoff: 250 },
          { lat: b.lat, lon: b.lng, search_cutoff: 250 },
        ],
        costing: "pedestrian",
        costing_options: { pedestrian: { walking_speed: 5.1 } },
        units: "kilometers",
        language: "en-US",
      });
      if (result.trip?.status !== 0 || result.trip.legs?.length !== 1)
        throw new Error(`No route: ${l.id}:${b.id}`);
      const leg = result.trip.legs[0],
        coordinates = decodePolyline(leg.shape),
        origin: [number, number] = [l.lng, l.lat],
        destination: [number, number] = [b.lng, b.lat];
      r = {
        version: 1,
        listingId: l.id,
        cityId: l.cityId,
        buildingId: b.id,
        mode: "pedestrian",
        origin,
        destination,
        coordinates,
        distanceMeters: Math.round(result.trip.summary.length * 1000),
        durationSeconds: result.trip.summary.time,
        startOffsetMeters: Math.round(metersBetween(origin, coordinates[0])),
        endOffsetMeters: Math.round(
          metersBetween(destination, coordinates.at(-1)!),
        ),
        steps: leg.maneuvers.map(
          (m: {
            instruction: string;
            length: number;
            begin_shape_index: number;
            end_shape_index: number;
          }) => ({
            instruction: m.instruction,
            distanceMeters: Math.round(m.length * 1000),
            begin: m.begin_shape_index,
            end: m.end_shape_index,
          }),
        ),
        source: {
          engine: "Valhalla",
          network: "OpenStreetMap",
          endpoint: `${endpoint}/route`,
          calculatedAt: new Date().toISOString(),
          walkingSpeedKmh: 5.1,
        },
      };
      parseWalkingRoute(r, l, { ...getCity(l.cityId), lng: b.lng, lat: b.lat });
      writeFileSync(path, JSON.stringify(r) + "\n");
    }
    parseWalkingRoute(r, l, { ...getCity(l.cityId), lng: b.lng, lat: b.lat });
    summaries[`${l.id}:${b.id}`] = {
      listingId: l.id,
      buildingId: b.id,
      cityId: l.cityId,
      distanceMeters: r.distanceMeters,
      durationSeconds: r.durationSeconds,
      startOffsetMeters: r.startOffsetMeters,
      endOffsetMeters: r.endOffsetMeters,
      source: r.source,
    };
    saveIndex();
    console.log(
      `${l.id} -> ${b.name}: ${r.distanceMeters}m / ${Math.ceil(r.durationSeconds / 60)}min`,
    );
  }
  mkdirSync("public/campus-catchments", { recursive: true });
  const path = `public/campus-catchments/${b.id.replace("/", "-")}.json`;
  const result = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : await query("isochrone", {
        locations: [{ lat: b.lat, lon: b.lng }],
        costing: "pedestrian",
        costing_options: { pedestrian: { walking_speed: 5.1 } },
        contours: [{ time: 10 }, { time: 20 }, { time: 30 }],
        polygons: true,
        reverse: true,
        denoise: 1,
        generalize: 10,
      });
  if (!Array.isArray(result.features) || result.features.length !== 3)
    throw new Error(`No catchments: ${b.id}`);
  if (!result.atlasCalculatedAt)
    result.atlasCalculatedAt = existsSync(path)
      ? statSync(path).mtime.toISOString()
      : new Date().toISOString();
  writeFileSync(path, JSON.stringify(result) + "\n");
  for (const f of result.features) {
    if (
      ![10, 20, 30].includes(f.properties?.contour) ||
      !["Polygon", "MultiPolygon"].includes(f.geometry?.type)
    )
      throw new Error("Invalid catchment geometry");
    catchments[`${b.id}:${f.properties.contour}`] = {
      buildingId: b.id,
      minutes: f.properties.contour,
      geometry: f.geometry,
      source: {
        endpoint: `${endpoint}/isochrone`,
        calculatedAt: result.atlasCalculatedAt,
        reverse: true,
        walkingSpeedKmh: 5.1,
      },
    };
  }
  saveIndex();
  console.log(`catchments: ${b.name}`);
}
console.log(
  `Complete: ${Object.keys(summaries).length} routes, ${Object.keys(catchments).length} catchments.`,
);
