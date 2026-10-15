import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapSearchIndex, searchMapPlaces } from "../lib/map-place-search";
import { cities, listings } from "../lib/rental-data";
import type { CityAmenities } from "../lib/amenities";
import { selectAmenities } from "../lib/amenity-query";

const london = cities.find(city => city.id === "london")!;
const homes = listings.filter(home => home.cityId === london.id);
const amenities = JSON.parse(readFileSync(new URL("../public/amenities/london.json", import.meta.url), "utf8")) as CityAmenities;
const index = mapSearchIndex(london, homes, amenities, "zh");
const search = (query: string) => searchMapPlaces(index, query, [london.lng, london.lat]);

test("finds named homes, building aliases and bilingual campus names", () => {
  assert.equal(search("ＣＨＡＰＴＥＲ house").results[0]?.id, "london-2");
  assert.ok(search("Student Centre").results.some(result => result.kind === "building"));
  assert.ok(search("伦敦大学学院").results.some(result => result.kind === "campus"));
  assert.ok(search("University College London").results.some(result => result.kind === "campus"));
});
test("facility names tolerate apostrophes; categories work in both languages", () => {
  assert.ok(search("sainsbury’s local").results.some(result => result.kind === "amenity"));
  for (const query of ["便利店", "convenience store"]) {
    const result = search(query);
    assert.ok(result.total > 0);
    assert.ok(result.results.every(item => item.kind === "amenity" && item.amenity.category === "convenience"));
  }
  assert.deepEqual(search("便利店").results.map(item => item.id), search("convenience store").results.map(item => item.id));
});
test("search respects city and current home filters, bounds results and handles no matches", () => {
  const filtered = mapSearchIndex(london, [homes[0], listings.find(home => home.cityId === "sydney")!], amenities, "en");
  assert.equal(searchMapPlaces(filtered, "Chapter House", [0, 0]).total, 0);
  assert.equal(filtered.filter(item => item.kind === "home").length, 1);
  assert.equal(search("no such place xyz").total, 0);
  assert.deepEqual(search("???").results, []);
  assert.ok(search("便利店").results.length <= 10);
  assert.equal(mapSearchIndex(cities.find(city => city.id === "sydney")!, [], amenities, "en").some(item => item.kind === "amenity"), false);
  assert.ok(search("   ").results.every(item => item.kind !== "amenity"));
});
test("a searched facility can be revealed by the existing map selection pipeline", () => {
  const item = search("sainsburys local").results.find(result => result.kind === "amenity")!;
  assert.equal(item.kind, "amenity");
  if (item.kind !== "amenity") return;
  const visible = selectAmenities(amenities, [homes[0].lng, homes[0].lat], {categories:[item.amenity.category],radiusMeters:0,cuisine:"",placeIds:[item.id]});
  assert.deepEqual(visible.map(place => place.id), [item.id]);
});
