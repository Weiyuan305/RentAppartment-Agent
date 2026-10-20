import assert from 'node:assert/strict';
import { matchesFilters, emptyFilters } from '../lib/assistant.ts';
import { cities, listings } from '../lib/rental-data.ts';
const picked = {...emptyFilters, budget:600, roomType:'独立 Studio', walkMinutes:30};
assert.deepEqual(listings.filter(l=>l.cityId==='sydney'&&matchesFilters(l,picked)).map(l=>l.id),['sydney-2']);
assert.equal(listings.filter(l=>l.cityId==='sydney'&&matchesFilters(l,{...emptyFilters,budget:1})).length,0);
assert.equal(cities.length,11);assert.equal(listings.length,70);assert.equal(new Set(listings.map(l=>l.id)).size,70);
for(const city of cities){assert.equal(listings.filter(l=>l.cityId===city.id).length,city.id==="manchester"?10:6);}
console.log('PASS: eleven cities / 70 unique listings; Manchester pilot adds four demo homes; combined filtering; real campus commute filtering; empty budget results.');

const { resolveMapConfig } = await import('../lib/map-config.ts');
assert.equal(resolveMapConfig({}).provider,'cesium-ion');
assert.equal(resolveMapConfig({VITE_GOOGLE_MAPS_API_KEY:'test-key'}).configured,false, 'Do not fall back to Google without explicitly selecting it');
assert.deepEqual(resolveMapConfig({VITE_CESIUM_ION_ACCESS_TOKEN:' test-token ',VITE_GOOGLE_MAPS_API_KEY:'test-key'}),{provider:'cesium-ion',credential:'test-token',configured:true,validProvider:true});
assert.equal(resolveMapConfig({VITE_MAP_PROVIDER:'google-maps',VITE_CESIUM_ION_ACCESS_TOKEN:'test-token'}).configured,false,'Google mode must not silently use ion');
assert.equal(resolveMapConfig({VITE_MAP_PROVIDER:'google-maps',VITE_GOOGLE_MAPS_API_KEY:'test-key'}).configured,true);
assert.equal(resolveMapConfig({VITE_CESIUM_ION_ACCESS_TOKEN:'你的只读token'}).configured,false);
assert.equal(resolveMapConfig({VITE_CESIUM_ION_ACCESS_TOKEN:'   '}).configured,false);
assert.equal(resolveMapConfig({VITE_MAP_PROVIDER:'typo',VITE_CESIUM_ION_ACCESS_TOKEN:'test-token'}).configured,false);
console.log('PASS: ion default; explicit provider selection; no credential fallback; blank, placeholder and invalid-provider guards.');
