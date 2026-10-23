import test from "node:test";
import assert from "node:assert/strict";
import { listings } from "../lib/rental-data";
import { rentalStateSchema } from "../lib/agent/contract";
import { validateStudentPlan } from "../lib/student/planner";
import {
  advisorWaitCopy, answersFromAgent, buildingLabel, clearChip, commuteFact, compareHome, contextLine,
  emptyAnswers, groceryFact, guidedRentalState, monthlyRent, oneLineReason, questionBuildings, questionSteps, shortlistHomes,
} from "../lib/guided/decide";
import { readFileSync } from "node:fs";
import {
  chooseGuidedMapProvider, downloadConsent, fallbackDatasetEnv, firstTileTimeoutMs, googleMapResources, guidedMapStorageKey,
  localBuildingDataset, localDataTimeoutMs, mapSourceNotes, needsGoogleProbe, openMapResources, probeGoogleHosts, probeTimeoutMs,
  probeUrl, readRememberedProvider, rememberGuidedProvider, resolveFallbackDataset, resolveGuidedProvider, schematicCampusBlocks,
  shouldLoad3D, unmeteredConnection, visitorCountry, campusFrame,
} from "../lib/guided/map-provider";

const wingFat = { name: "Wing Fat", lng: -2.2394868, lat: 53.4785112, category: "asian_grocery", origin: "chinese" };
const manchester = listings.filter(listing => listing.cityId === "manchester");

test("four questions stay on the Manchester campus buildings", () => {
  assert.deepEqual(questionSteps, ["building", "budget", "moveIn", "living"]);
  const buildings = questionBuildings();
  assert.ok(buildings.length >= 4);
  assert.equal(buildingLabel("way/217170181"), "惠特沃思礼堂");
  assert.ok(buildings.every(building => building.id.startsWith("way/")));
});

test("shortlist is 3–5 Manchester homes with a real walking time", () => {
  const answers = { ...emptyAnswers(), buildingId: "way/217170181", weeklyBudget: 220, living: "alone" as const, priority: "commute" as const };
  const homes = shortlistHomes(listings, answers, [wingFat]);
  assert.ok(homes.length >= 3 && homes.length <= 5);
  assert.ok(homes.every(home => home.listing.cityId === "manchester"));
  assert.equal(homes[0]?.listing.id, "manchester-1");
  assert.match(homes[0]!.reason, /步行 11 分钟到惠特沃思礼堂/);
  assert.match(homes[0]!.reason, /每周少 £40/);
  assert.equal(homes[0]!.sign, "11 分钟 步行 · 惠特沃思礼堂");
  assert.equal(commuteFact(manchester[0]!, "way/217170181")?.minutes, 11);
  assert.doesNotMatch(homes[0]!.reason, /manchester-\d/);
});

test("shared homes stay in the shared shortlist and over-budget homes are not required", () => {
  const answers = { ...emptyAnswers(), buildingId: "way/217170181", weeklyBudget: 180, living: "shared" as const };
  const homes = shortlistHomes(listings, answers);
  assert.ok(homes.every(home => home.listing.roomType === "合租单间"));
  assert.ok(homes.every(home => home.listing.price <= 180));
  assert.equal(homes[0]?.listing.id, "manchester-5");
});

test("compare shows rent that is in the catalogue and refuses a made-up deposit", () => {
  const answers = { ...emptyAnswers(), buildingId: "way/217170181" };
  const included = compareHome(listings.find(listing => listing.id === "manchester-1")!, answers);
  const excluded = compareHome(listings.find(listing => listing.id === "manchester-3")!, answers, [wingFat]);
  assert.equal(monthlyRent(listings.find(listing => listing.id === "manchester-1")!), 780);
  assert.equal(included.monthlyTotal.status, "known");
  assert.match(included.monthlyTotal.text, /£780/);
  assert.equal(excluded.bills.status, "unknown");
  assert.equal(excluded.monthlyTotal.status, "unknown");
  assert.equal(excluded.deposit.status, "unknown");
  assert.equal(excluded.contract.status, "unknown");
  assert.equal(included.deposit.text, "未知");
  assert.doesNotMatch(`${included.deposit.detail} ${excluded.deposit.detail}`, /£\d/);
  assert.match(included.risks.join(" "), /没有安全评分/);
  assert.match(contextLine(shortlistHomes(listings, { ...answers, weeklyBudget: 220, living: "alone" })[0]!, { ...answers, weeklyBudget: 220 }), /未知/);
});

test("a home outside the amenity snapshot does not invent a nearby supermarket", () => {
  const far = listings.find(listing => listing.id === "manchester-7")!;
  const grocery = groceryFact(far, [wingFat]);
  assert.equal(grocery.status, "unknown");
  const reason = oneLineReason(far, emptyAnswers(), commuteFact(far, null), grocery);
  assert.doesNotMatch(reason, /Wing Fat|附近有/);
});

test("clearing a chip and an agent filter both change the answers without leaving Manchester", () => {
  const answers = clearChip({ ...emptyAnswers(), weeklyBudget: 220, living: "shared", buildingId: "way/75361245" }, "budget");
  assert.equal(answers.weeklyBudget, null);
  const state = guidedRentalState(answers, "manchester-4", true);
  assert.equal(rentalStateSchema.safeParse(state).success, true);
  assert.doesNotThrow(() => validateStudentPlan(state.student, "manchester"));
  assert.equal(state.cityId, "manchester");
  assert.equal(state.student?.routeBuilding, true);
  const next = answersFromAgent(answers, { ...state, filters: { ...state.filters, budget: 190, walkMinutes: 20 }, listingId: "manchester-2" });
  assert.equal(next.weeklyBudget, 190);
  assert.equal(next.walkMinutes, 20);
  assert.equal(next.living, "shared");
});

test("the advisor names the wait immediately and offers a rephrase after 15 seconds", () => {
  assert.match(assistantWait(0), /正在看曼城 10 套房/);
  assert.match(assistantWait(4), /步行时间/);
  assert.match(assistantWait(15), /押金/);
  function assistantWait(seconds: number) { return advisorWaitCopy(seconds, manchester.length); }
});

test("map provider, connection and preload follow the campus rules", () => {
  assert.equal(unmeteredConnection(null), false);
  assert.equal(unmeteredConnection({}), false);
  assert.equal(unmeteredConnection({ type: "unknown" }), false);
  assert.equal(unmeteredConnection({ type: "cellular" }), false);
  assert.equal(unmeteredConnection({ type: "wifi", saveData: true }), false);
  assert.equal(unmeteredConnection({ type: "wifi" }), true);
  assert.equal(unmeteredConnection({ type: "ethernet" }), true);
  const base = { mobile: true, unmetered: false, answeredOnce: false, asking: true, accepted: false };
  assert.equal(shouldLoad3D({ ...base, mobile: false }), true);
  assert.equal(shouldLoad3D(base), false);
  assert.equal(shouldLoad3D({ ...base, unmetered: true }), false);
  assert.equal(shouldLoad3D({ ...base, unmetered: true, answeredOnce: true }), true);
  assert.equal(shouldLoad3D({ ...base, asking: false }), false);
  assert.equal(shouldLoad3D({ ...base, asking: false, accepted: true }), true);
  assert.equal(shouldLoad3D({ ...base, unmetered: true, asking: false }), true);
  assert.equal(chooseGuidedMapProvider({ preference: "auto", webgl: true, googleReachable: true, photorealisticConfigured: false }).provider, "osm-buildings");
  assert.equal(chooseGuidedMapProvider({ preference: "auto", webgl: true, googleReachable: false, photorealisticConfigured: true }).reason, "google-unreachable");
  assert.equal(chooseGuidedMapProvider({ preference: "google-photorealistic", webgl: true, googleReachable: true, photorealisticConfigured: true }).provider, "google-photorealistic");
  assert.equal(chooseGuidedMapProvider({ preference: "auto", webgl: false, googleReachable: true, photorealisticConfigured: true }).provider, "prerendered-video");
  assert.equal(chooseGuidedMapProvider({ preference: "osm-buildings", webgl: true, googleReachable: true, photorealisticConfigured: true }).provider, "osm-buildings");
  assert.match(downloadConsent("google-photorealistic", true).action, /10MB/);
  assert.doesNotMatch(downloadConsent("osm-buildings", true).action, /10MB/);
  const notes = mapSourceNotes("osm-buildings");
  assert.match(notes.google.join(" "), /tile\.googleapis\.com/);
  assert.match(notes.google.join(" "), /2275207/);
  assert.ok(googleMapResources.some(resource => (resource.hosts as readonly string[]).includes("maps.googleapis.com")));
  assert.equal(firstTileTimeoutMs, 8000);
  assert.equal(probeTimeoutMs, 3000);
  assert.ok(localDataTimeoutMs <= 4000);
  assert.equal(localBuildingDataset, "/guided/uom-buildings.geojson");
  assert.doesNotMatch(JSON.stringify(openMapResources), /ion\.cesium|openfreemap|overpass|valhalla1/i);
  const buildings = JSON.parse(readFileSync(new URL("../public/guided/uom-buildings.geojson", import.meta.url), "utf8")) as { type: string; source: string; features: Array<{ properties: { height: number }; geometry: { type: string } }> };
  assert.equal(buildings.type, "FeatureCollection");
  assert.equal(buildings.source, "OpenStreetMap");
  assert.ok(buildings.features.length > 10 && buildings.features.length <= 80);
  assert.ok(buildings.features.every(feature => feature.geometry.type === "Polygon" && feature.properties.height > 0));
  for (const block of schematicCampusBlocks()) {
    assert.equal(block.schematic, true);
    assert.ok(block.lng >= campusFrame.west && block.lng <= campusFrame.east);
    assert.ok(block.lat >= campusFrame.south && block.lat <= campusFrame.north);
  }
});

test("China defaults to the self-hosted fallback, and a failed probe is remembered", async () => {
  assert.equal(visitorCountry("cn"), "CN");
  assert.equal(visitorCountry("XX"), null);
  assert.equal(visitorCountry("T1"), null);
  assert.equal(fallbackDatasetEnv, "VITE_GUIDED_FALLBACK");
  assert.deepEqual(resolveFallbackDataset(undefined), { kind: "osm-extrusion", url: localBuildingDataset });
  assert.deepEqual(resolveFallbackDataset("/guided/model/tileset.json"), { kind: "3d-tiles", url: "/guided/model/tileset.json" });
  assert.deepEqual(resolveFallbackDataset("https://assets.ion.cesium.com/2275207/tileset.json"), { kind: "osm-extrusion", url: localBuildingDataset });
  const china = chooseGuidedMapProvider({ preference: "auto", webgl: true, googleReachable: true, photorealisticConfigured: true, country: "CN", remembered: "google-photorealistic" });
  assert.equal(china.provider, "osm-buildings");
  assert.equal(china.reason, "country");
  assert.equal(chooseGuidedMapProvider({ preference: "google-photorealistic", webgl: true, googleReachable: true, photorealisticConfigured: true, country: "CN" }).provider, "google-photorealistic");
  assert.equal(chooseGuidedMapProvider({ preference: "auto", webgl: true, googleReachable: true, photorealisticConfigured: true, country: "GB", remembered: "osm-buildings" }).reason, "remembered");
  assert.equal(needsGoogleProbe({ preference: "auto", webgl: true, photorealisticConfigured: true, country: "CN" }), false);
  assert.equal(needsGoogleProbe({ preference: "auto", webgl: true, photorealisticConfigured: false, country: "GB" }), false);
  assert.equal(needsGoogleProbe({ preference: "auto", webgl: true, photorealisticConfigured: true, country: "GB" }), true);
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
  rememberGuidedProvider(storage, "prerendered-video");
  assert.equal(readRememberedProvider(storage), null);
  rememberGuidedProvider(storage, "osm-buildings");
  assert.equal(storage.getItem(guidedMapStorageKey), "osm-buildings");
  assert.equal(readRememberedProvider(storage), "osm-buildings");
  let probed = false;
  const skipped = await resolveGuidedProvider({ preference: "auto", webgl: true, photorealisticConfigured: true, country: "CN", remembered: null }, async () => { probed = true; return true; });
  assert.equal(probed, false);
  assert.equal(skipped.provider, "osm-buildings");
  const missed = await resolveGuidedProvider({ preference: "auto", webgl: true, photorealisticConfigured: true, country: "GB", remembered: null }, async () => false);
  assert.equal(missed.reason, "google-unreachable");
  assert.equal(missed.probed, true);
  let seen = "";
  const reached = await probeGoogleHosts({
    hosts: ["maps.googleapis.com"],
    timeoutMs: 1000,
    fetchImpl: async (input, init) => {
      seen = String(input);
      assert.equal(init?.credentials, "omit");
      assert.equal(init?.mode, "no-cors");
      assert.equal(new Headers(init?.headers).get("authorization"), null);
      return new Response(null, { status: 401 });
    },
  });
  assert.equal(reached, true);
  assert.equal(seen, probeUrl("maps.googleapis.com"));
  assert.doesNotMatch(seen, /token|key=/i);
  const started = Date.now();
  const hung = await probeGoogleHosts({
    hosts: ["tile.googleapis.com", "api.cesium.com"],
    timeoutMs: 40,
    fetchImpl: (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  });
  assert.equal(hung, false);
  assert.ok(Date.now() - started < 500);
});
