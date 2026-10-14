import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cities } from '../lib/rental-data.ts';
import { amenityCategories, primaryAmenityCategories, amenityGroups, amenitySourceUrl, parseCityAmenities, categoryFromTags, matchesAmenityCategory } from '../lib/amenities.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
let total = 0;
for (const city of cities) {
  const data = parseCityAmenities(JSON.parse(readFileSync(`${root}/public/amenities/${city.id}.json`, 'utf8')), city);
  const raw = JSON.parse(readFileSync(`${root}/../research/evidence/amenities/${city.id}.json`, 'utf8'));
  const originals = new Map(raw.elements.map(e => [`${e.type}/${e.id}`, e]));
  for (const p of data.places) {
    const e = originals.get(p.id);
    assert.ok(e, `${p.id}: must come from saved OSM evidence`);
    const location = e.type === 'node' ? e : e.center;
    assert.equal(p.lng, location.lon);
    assert.equal(p.lat, location.lat);
    for (const [key, value] of Object.entries(p.tags)) assert.equal(value, e.tags[key]);
    assert.ok(amenitySourceUrl(p).startsWith('https://www.openstreetmap.org/'));
  }
  assert.equal(data.version, 2, `${city.id}: expanded snapshot must be collected`);
  // Original snapshots have verified category coverage. New campuses may genuinely lack a mapped mall/hospital.
  if(["london","sydney","singapore","kuala-lumpur","hong-kong"].includes(city.id)) for (const category of primaryAmenityCategories) assert.ok(data.places.some(p => p.category === category), `${city.id}: ${category} snapshot`);
  for (const group of amenityGroups) assert.ok(data.places.some(p => group.categories.includes(p.category)), `${city.id}: ${group.name} snapshot`);
  const invalid = change => { const copy = structuredClone(data); change(copy); assert.throws(() => parseCityAmenities(copy, city)); };
  invalid(d => {d.cityId = 'wrong-city';});
  invalid(d => {d.radiusMeters = 30000;});
  invalid(d => {d.places[0].lng = 181;});
  invalid(d => {d.places[0].lat = Number.NaN;});
  invalid(d => {d.places[0].category = 'not-a-category';});
  invalid(d => {d.places[0].tags = {shop:'furniture'};});
  invalid(d => {d.places.push(d.places[0]);});
  invalid(d => {d.places[0].id = 'node/1?redirect=elsewhere';});
  invalid(d => {d.source.collectedAt = 'unknown';});
  invalid(d => {d.places[0].tags.cuisine = 123;});
  invalid(d => {d.places[0].studySource = 'https://example.org/fake';});
  assert.ok(data.places.some(p=>matchesAmenityCategory(p,'study')), `${city.id}: official study space`);
  if (city.id === 'singapore') assert.ok(!data.places.some(p => p.id === 'way/109100976'), 'Mortuary must not be presented as a hospital');
  if (city.id === 'london') assert.ok(!data.places.some(p => p.id === 'way/988525443'), 'Laboratory must not be presented as a hospital');
  if (city.id === 'hong-kong') assert.ok(!data.places.some(p => p.id === 'node/7639850987'), 'Speech clinic must not be presented as a hospital');
  total += data.places.length;
  console.log(`${city.id}: ${data.places.length} source-matched POIs`);
}
for (const [tags, category] of [[{railway:'subway_entrance'},'rail'],[{highway:'bus_stop'},'bus'],[{shop:'supermarket',origin:'asian'},'asian_grocery'],[{shop:'supermarket'},'supermarket'],[{amenity:'library',building:'university'},'library'],[{building:'university'},'teaching'],[{amenity:'study_space'},'study'],[{amenity:'pharmacy'},'pharmacy'],[{healthcare:'clinic'},'clinic'],[{amenity:'food_court'},'canteen'],[{amenity:'canteen'},'canteen'],[{amenity:'cafe'},'cafe'],[{leisure:'fitness_centre'},'gym'],[{leisure:'pitch'},'sports'],[{leisure:'park'},'park'],[{shop:'laundry'},'laundry'],[{shop:'copyshop'},'printing'],[{amenity:'parcel_locker'},'parcel']]) assert.equal(categoryFromTags(tags), category);
assert.equal(categoryFromTags({shop:'supermarket',name:'Asian Food Market'}), 'supermarket', 'Do not infer Asian products from a name');
assert.ok(matchesAmenityCategory({category:'asian_grocery',tags:{shop:'supermarket'}}, 'supermarket'), 'Asian supermarkets must also appear under supermarkets');
assert.equal(amenityCategories.length, 21);
console.log(`PASS: ${total} OSM records in ${cities.length} campus snapshots; original coordinates/tags, categories, scope, sources and invalid-response guards.`);
