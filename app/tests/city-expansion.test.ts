import { test } from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {cities,cityIds,countries,citiesInCountry,listings,cityPhoto} from "../lib/rental-data";
import {cityIdSchema,initialRentalState} from "../lib/agent/contract";
import {displayCity} from "../lib/i18n";
import {matchesFilters,emptyFilters} from "../lib/assistant";
import {parseWalkingRoute} from "../lib/walking-route";
import {transitSources} from "../lib/student/transit";
import {validateRentalState,getAmenities} from "../lib/agent/catalog";
const expanded=["manchester","edinburgh","liverpool","birmingham","melbourne","canberra"];
test("country selection groups eleven supported cities into five regions",()=>{
  assert.equal(countries.length,5);
  assert.equal(citiesInCountry("uk").length,5);
  assert.equal(citiesInCountry("au").length,3);
  for(const id of ["sg","my","hk"] as const)assert.equal(citiesInCountry(id).length,1);
  assert.deepEqual(new Set(cities.map(c=>c.id)),new Set(cityIds));
  for(const city of cities){assert.equal(cityIdSchema.parse(city.id),city.id);assert.ok(displayCity(city,"en").university);assert.ok(transitSources[city.id].url.startsWith("https://"));}
});
test("new cities support scoped agent sessions, photos, amenities and real commute filtering",()=>{
  for(const city of cities.filter(c=>expanded.includes(c.id))){
    assert.equal(validateRentalState(initialRentalState(city.id)).cityId,city.id);
    assert.ok(existsSync(`public${cityPhoto(city.id)}`));
    assert.ok(getAmenities(city.id).places.length>0);
    const homes=listings.filter(l=>l.cityId===city.id);assert.equal(homes.length,6);
    for(const home of homes){
      const route=parseWalkingRoute(JSON.parse(readFileSync(`public/routes/${home.id}.json`,"utf8")),home,city);
      for(const minutes of [10,20,30])assert.equal(matchesFilters(home,{...emptyFilters,walkMinutes:minutes}),route.durationSeconds<=minutes*60,`${home.id}: ${minutes} minute filter`);
    }
  }
});
test("every new apartment/building pair has a validated route and matching commute summary", async()=>{
  const {buildingsInCity,buildingCommute,buildingRouteUrl}=await import("../lib/student/catalog");
  let checked=0;
  for(const city of cities.filter(c=>expanded.includes(c.id))){
    const buildings=buildingsInCity(city.id);assert.equal(buildings.length,4);
    for(const home of listings.filter(l=>l.cityId===city.id))for(const building of buildings){
      const route=parseWalkingRoute(JSON.parse(readFileSync(`public${buildingRouteUrl(home.id,building.id)}`,"utf8")),home,{...city,lng:building.lng,lat:building.lat});
      const summary=buildingCommute(home.id,building.id)!;
      assert.equal(summary.durationSeconds,route.durationSeconds);
      assert.equal(summary.distanceMeters,route.distanceMeters);
      checked++;
    }
  }
  assert.equal(checked,144);
});
