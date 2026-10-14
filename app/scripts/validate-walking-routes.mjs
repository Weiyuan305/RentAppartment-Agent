import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listings, getCity } from '../lib/rental-data.ts';
import { decodePolyline, metersBetween, parseWalkingRoute, routeMinutes } from '../lib/walking-route.ts';

const root = new URL('../public/routes/', import.meta.url);
// Known polyline example catches latitude/longitude swaps and precision changes.
assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5), [[-120.2,38.5],[-120.95,40.7],[-126.453,43.252]]);
assert.throws(() => decodePolyline('_'));
let points = 0;
for (const listing of listings) {
  const city = getCity(listing.cityId);
  const route = parseWalkingRoute(JSON.parse(readFileSync(fileURLToPath(new URL(`${listing.id}.json`, root)), 'utf8')), listing, city);
  assert.ok(route.coordinates.length > 2, `${listing.id}: require road geometry, not an invented two-point connector`);
  const length = route.coordinates.slice(1).reduce((sum, p, i) => sum + metersBetween(route.coordinates[i], p), 0);
  assert.ok(Math.abs(length - route.distanceMeters) / route.distanceMeters < 0.1, `${listing.id}: road shape must agree with provider distance`);
  assert.ok(route.distanceMeters + 5 >= metersBetween(route.coordinates[0], route.coordinates.at(-1)), `${listing.id}: route cannot be shorter than the snapped endpoints' straight distance`);
  assert.equal(route.source.endpoint, 'https://valhalla1.openstreetmap.de/route');
  assert.throws(() => parseWalkingRoute({...route, listingId:'other-listing'}, listing, city));
  assert.throws(() => parseWalkingRoute({...route, mode:'auto'}, listing, city));
  assert.throws(() => parseWalkingRoute({...route, destination:[0,0]}, listing, city));
  assert.throws(() => parseWalkingRoute({...route, coordinates:[[0,0],[0,1]]}, listing, city));
  assert.throws(() => parseWalkingRoute({...route, durationSeconds:NaN}, listing, city));
  points += route.coordinates.length;
}
assert.equal(listings.length,66);
const london = JSON.parse(readFileSync(new URL('london-1.json',root),'utf8'));
assert.equal(london.distanceMeters,741);
assert.equal(routeMinutes(london.durationSeconds),10);
console.log(`PASS: ${listings.length} pedestrian routes / ${points} road points; source, endpoints, geometry-distance agreement, precision, wrong listing/mode/coordinates and invalid duration guards.`);
