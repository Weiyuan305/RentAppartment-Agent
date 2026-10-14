// Bounded, sequential Overpass snapshots. Never used as the visitor-facing backend.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { cities } from '../lib/rental-data.ts';
import { amenityInfo, amenityTagKeys, amenityOverpassEndpoints, categoryFromTags, parseCityAmenities } from '../lib/amenities.ts';
import { metersBetween } from '../lib/walking-route.ts';
import { studySpaceReferences } from '../lib/study-space-references.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'public/amenities');
const evidence = resolve(root, '../research/evidence/amenities');
const endpoint = process.argv.find(arg => arg.startsWith('--endpoint='))?.slice('--endpoint='.length) || amenityOverpassEndpoints[0];
if (!amenityOverpassEndpoints.includes(endpoint)) throw new Error('Unsupported Overpass endpoint');
const requested = process.argv.find(arg => arg.startsWith("--cities="))?.slice(9).split(",");
if(requested?.some(id=>!cities.some(city=>city.id===id)))throw new Error("Unknown amenity city");
const normalize = process.argv.includes('--normalize');
mkdirSync(output, { recursive: true });
mkdirSync(evidence, { recursive: true });
for (const city of cities) {
  if(requested && !requested.includes(city.id))continue;
  const path = resolve(output, `${city.id}.json`);
  if (existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).version === 2 && !process.argv.includes('--refresh') && !normalize) {
    parseCityAmenities(JSON.parse(readFileSync(path, 'utf8')), city);
    console.log(`${city.id}: cached`);
    continue;
  }
  // A bounding-box index avoids repeating expensive circular searches for each
  // tag family. The exact 3 km circle is still enforced below for every record.
  const latDelta = 3000 / 111000, lngDelta = latDelta / Math.cos(city.lat * Math.PI / 180);
  const region = `(${city.lat-latDelta},${city.lng-lngDelta},${city.lat+latDelta},${city.lng+lngDelta})`;
  const selectors = [
    '[amenity~"^(hospital|bus_station|university|college|library|study_space|study_area|pharmacy|clinic|doctors|restaurant|fast_food|food_court|cafe|canteen|post_office|parcel_locker|parcel_pickup|post_depot)$"]',
    '[healthcare~"^(hospital|clinic|doctor)$"]',
    '[shop~"^(convenience|mall|supermarket|grocery|food|laundry|dry_cleaning|copyshop|printing|courier)$"]',
    '[railway~"^(station|halt|tram_stop|subway_entrance)$"]', '[public_transport=station]', '[highway=bus_stop]',
    '[building~"^(university|college)$"]', '[education=university]', '[leisure~"^(fitness_centre|pitch|sports_centre|track|park)$"]',
  ];
  const query = `[out:json][timeout:45][maxsize:67108864];(\n${selectors.map(selector => `nwr${selector}${region};`).join('\n')}\n);out tags center;`;
  const rawPath = resolve(evidence, `${city.id}.json`);
  if (!normalize) await new Promise(done => setTimeout(done, 10000));
  console.log(`${city.id}: ${normalize ? 'normalizing saved evidence' : 'querying bounded student amenities'}`);
  const raw = normalize ? readFileSync(rawPath, 'utf8') : execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--connect-timeout', '10', '--max-time', '70', '--get', '--header', 'Accept: application/json',
    '--retry', '1', '--retry-delay', '20', '--retry-max-time', '100',
    '--user-agent', 'CampusAtlas-RentalValidation/0.1 (student-campus POI snapshot)',
    '--data-urlencode', `data=${query}`, endpoint], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const payload = JSON.parse(raw);
  if (payload.remark || !Array.isArray(payload.elements)) {
    writeFileSync(resolve(evidence, `${city.id}.failed-response.json`), raw + '\n');
    throw new Error(`Incomplete Overpass response: ${city.id}: ${String(payload.remark).slice(0,300)}`);
  }
  const places = [];
  for (const element of payload.elements) {
    const tags = element.tags ?? {};
    if (tags.disused === 'yes' || tags.abandoned === 'yes' || tags.demolished === 'yes') continue;
    const official = studySpaceReferences[`${element.type}/${element.id}`];
    const studySource = official?.cityId === city.id ? official.url : undefined;
    const category = (studySource ? official.category : undefined) || categoryFromTags(tags);
    const location = element.type === 'node' ? element : element.center;
    if (!category || !location || !Number.isFinite(location.lon) || !Number.isFinite(location.lat)
      || metersBetween([city.lng, city.lat], [location.lon, location.lat]) > 3000) continue;
    const rawName = tags['name:zh-Hans'] || tags['name:zh'] || tags['name:zh-Hant'] || tags.name || tags['name:en'];
    // OSM occasionally labels a mortuary or outpatient clinic as a hospital.
    // Exclude clearly conflicting names; retain the raw response for an auditable snapshot.
    const names = [rawName, tags.name, tags['name:en']].filter(Boolean).join(' ');
    if (category === 'hospital' && (/mortuary|殓房|殮房|太平间|太平間|\bconsulting suite\b|\bmain lobby\b/i.test(names)
      || (/\bclinics?\b|诊所|診所|\blaborator(?:y|ies)\b|\bdiagnostics\b|\bimaging centre\b|\bresearch facility\b/i.test(names)
        && !/\bhospital\b|医院|醫院/i.test(names)))) continue;
    const name = rawName || tags.brand || `未命名${amenityInfo[category].name}（OSM）`;
    // Only merge same named, same category records at nearly identical locations.
    // Keep separate chain branches; never merge all 7-Eleven stores by name.
    if (rawName && places.some(p => p.category === category && p.name === name && p.tags.ref === tags.ref
      && metersBetween([p.lng, p.lat], [location.lon, location.lat]) < 40)) continue;
    const address = [tags['addr:housenumber'], tags['addr:street'], tags['addr:unit'], tags['addr:postcode']].filter(Boolean).join(' ');
    places.push({ id: `${element.type}/${element.id}`, category, name, lng: location.lon, lat: location.lat,
      locationType: element.type === 'node' ? 'node' : 'area-center', ...(address ? { address } : {}),
      ...(studySource ? {studySource} : {}),
      tags: Object.fromEntries(amenityTagKeys.filter(k => tags[k]).map(k => [k, tags[k]])),
    });
  }
  places.sort((a, b) => metersBetween([city.lng, city.lat], [a.lng, a.lat]) - metersBetween([city.lng, city.lat], [b.lng, b.lat]));
  const data = parseCityAmenities({ version: 2, cityId: city.id, center: [city.lng, city.lat], radiusMeters: 3000, places,
    source: { provider: 'OpenStreetMap', endpoint: normalize && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).source.endpoint : endpoint, collectedAt: normalize && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).source.collectedAt : new Date().toISOString(), osmBase: payload.osm3s?.timestamp_osm_base },
  }, city);
  writeFileSync(resolve(evidence, `${city.id}.json`), raw + '\n');
  writeFileSync(resolve(evidence, `${city.id}.overpassql`), query + '\n');
  writeFileSync(path, JSON.stringify(data) + '\n');
  console.log(`${city.id}: ${places.length} records; ${Object.keys(amenityInfo).map(k => `${k}=${places.filter(p => p.category === k).length}`).join(', ')}`);
}
