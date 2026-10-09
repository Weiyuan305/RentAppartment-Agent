import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {database} from '../lib/agent/store.ts';
import {listings} from '../lib/rental-data.ts';
import {normalizeAmenityRoute,getAmenityRoute,RouteServiceError} from '../lib/amenity-route-server.ts';
import {parseAmenityWalkingRoute} from '../lib/walking-route.ts';
const fixture=JSON.parse(readFileSync(new URL('../../research/evidence/amenity-routes/london-2-hospital.json',import.meta.url),'utf8'));
const temporary=mkdtempSync(join(tmpdir(),'atlas-route-test-'));
process.env.ATLAS_CHAT_DB=join(temporary,'routes.sqlite');
const listing={...listings.find(l=>l.id===fixture.listingId),lng:fixture.origin[0],lat:fixture.origin[1]};
const place=fixture.place;
const route=normalizeAmenityRoute(fixture.payload,listing,place,fixture.calculatedAt);
assert.equal(route.source.engine,'OSRM');
assert.equal(route.distanceMeters,Math.round(fixture.payload.routes[0].distance));
assert.equal(route.durationSeconds,fixture.payload.routes[0].duration);
assert.deepEqual(route.coordinates,fixture.payload.routes[0].geometry.coordinates);
assert.deepEqual(route.destination,[place.lng,place.lat]);
for(const change of [r=>{r.amenityId='node/1';},r=>{r.listingId='sydney-1';},r=>{r.destination[0]+=0.1;},r=>{r.source.endpoint='https://example.org';},r=>{r.coordinates[0]=[0,0];},r=>{r.durationSeconds=NaN;},r=>{r.endOffsetMeters=251;},r=>{r.steps[0].end=999999;}]) {
  const copy=structuredClone(route);change(copy);assert.throws(()=>parseAmenityWalkingRoute(copy,listing,place));
}
assert.throws(()=>normalizeAmenityRoute({code:'NoRoute'},listing,place));
let calls=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{calls++;assert.ok(String(url).includes('/routed-foot/route/v1/foot/'));assert.equal(options.headers['User-Agent'],'CampusAtlas-RentalPreview/0.1');return Response.json(fixture.payload);};
try {
  const [first,second]=await Promise.all([getAmenityRoute(listing,place),getAmenityRoute(listing,place)]);
  assert.deepEqual(first,second);assert.equal(calls,1,'Concurrent duplicate requests share one calculation');
  assert.deepEqual(await getAmenityRoute(listing,place),first);assert.equal(calls,1,'A successful route is reused');
  await assert.rejects(getAmenityRoute(listing,{...place,id:'node/999'}),e=>e instanceof RouteServiceError&&e.status===429);
  assert.equal(calls,1,'The limiter rejects a new request before reaching the public service');
} finally {globalThis.fetch=originalFetch;database().close();rmSync(temporary,{recursive:true,force:true});}
console.log(`PASS: actual OSRM geometry (${route.coordinates.length} points), destination/source guards, duplicate requests, cache and upstream rate limiting.`);
