// Fetch only the 30 fixed sample routes, sequentially, with a reusable disk cache.
// Visitors use our saved results and do not call the community demo API.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { listings, getCity } from '../lib/rental-data.ts';
import { decodePolyline, metersBetween, parseWalkingRoute } from '../lib/walking-route.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'public/routes');
const evidence = resolve(root, '../research/evidence/walking-routes');
const endpoint = 'https://valhalla1.openstreetmap.de/route';
const force = process.argv.includes('--refresh');
mkdirSync(output, { recursive: true });
mkdirSync(evidence, { recursive: true });
for (const listing of listings) {
  const city = getCity(listing.cityId);
  const path = resolve(output, `${listing.id}.json`);
  if (existsSync(path) && !force) {
    parseWalkingRoute(JSON.parse(readFileSync(path, 'utf8')), listing, city);
    console.log(`${listing.id}: cached`);
    continue;
  }
  // At most one request per second. No parallel batch or automatic build-time refresh.
  await new Promise(done => setTimeout(done, 1100));
  const request = {
    locations: [{ lat: listing.lat, lon: listing.lng, search_cutoff: 250 }, { lat: city.lat, lon: city.lng, search_cutoff: 250 }],
    costing: 'pedestrian', costing_options: { pedestrian: { walking_speed: 5.1 } },
    units: 'kilometers', language: 'en-US',
  };
  const raw = execFileSync('curl', [
    '--fail', '--silent', '--show-error', '--location', '--max-time', '25', '--get', endpoint,
    '--header', 'X-Client-Id: campus-atlas-rental-validation', '--data-urlencode', `json=${JSON.stringify(request)}`,
  ], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  const payload = JSON.parse(raw);
  if (payload.trip?.status !== 0 || payload.trip?.legs?.length !== 1) throw new Error(`No walking route for ${listing.id}`);
  const leg = payload.trip.legs[0];
  const coordinates = decodePolyline(leg.shape);
  const origin = [listing.lng, listing.lat], destination = [city.lng, city.lat];
  const route = parseWalkingRoute({
    version: 1, listingId: listing.id, cityId: city.id, mode: 'pedestrian', origin, destination, coordinates,
    distanceMeters: Math.round(payload.trip.summary.length * 1000), durationSeconds: payload.trip.summary.time,
    startOffsetMeters: Math.round(metersBetween(origin, coordinates[0])),
    endOffsetMeters: Math.round(metersBetween(destination, coordinates.at(-1))),
    steps: leg.maneuvers.map(m => ({ instruction: m.instruction, distanceMeters: Math.round(m.length * 1000), begin: m.begin_shape_index, end: m.end_shape_index })),
    source: { engine: 'Valhalla', network: 'OpenStreetMap', endpoint, calculatedAt: new Date().toISOString(), walkingSpeedKmh: 5.1 },
  }, listing, city);
  writeFileSync(resolve(evidence, `${listing.id}.json`), raw + '\n');
  writeFileSync(path, JSON.stringify(route) + '\n');
  console.log(`${listing.id}: ${route.distanceMeters} m, ${Math.ceil(route.durationSeconds / 60)} min, ${coordinates.length} points, snap ${route.startOffsetMeters}/${route.endOffsetMeters} m`);
}
