import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { listings } from "../lib/rental-data";
import { advisorPendingCopy, REPHRASE_AFTER_SECONDS } from "../lib/v2/advisor-status";
import { compareFacts } from "../lib/v2/compare-facts";
import { applyInterpretation, interpretAdvisorText } from "../lib/v2/interpret";
import { GOOGLE_FIRST_TILE_MS, OVERSEAS_FAILFAST_MS, providerExternalDomains } from "../lib/overseas-failfast";
import { PHOTOREALISTIC_PROBE_URLS, REACHABILITY_PROBE_MS } from "../lib/v2/google-reachability";
import { FALLBACK_CITY_MODEL, MAP_PROVIDER_STORAGE_KEY, approximateMegabytes, connectionFromNavigator, decide3DLoad, googleTileBudget, overviewStillVisible, PHOTO_TILE_TIMEOUT_MS, readStoredProvider, resolveMapProviderId, selectMapProvider, writeStoredProvider } from "../lib/v2/map-provider";
import { geoQueryAllowed, resolveVisitorCountry } from "../lib/v2/visitor-country";
import { V2_FLIGHT_MS } from "../lib/v2/motion";
import { clearPreferences, countChangeLabel, emptyPreferences, preferenceChips, removePreference, visibleHomes } from "../lib/v2/preferences";
import { shortlistHomes } from "../lib/v2/shortlist";
import { signpostMinutes, signpostPlace, SIGNPOST_INK, SIGNPOST_YELLOW } from "../lib/v2/signpost";

const unmetered = { saveData: false, unmetered: true, type: "wifi" };
const metered = { saveData: false, unmetered: false, type: "cellular" };

describe("v2 map load policy", () => {
  it("keeps the overview up until the engine is ready and does not bill every visitor", () => {
    assert.equal(overviewStillVisible("photo"), true);
    assert.equal(overviewStillVisible("loading"), true);
    assert.equal(overviewStillVisible("ready"), false);
    assert.equal(resolveMapProviderId({}), "osm-buildings");
    assert.equal(resolveMapProviderId({ configured: "google-photorealistic", googleFailed: true }), "osm-buildings");
    assert.equal(resolveMapProviderId({ query: "aerial" }), "aerial");
  });

  it("loads desktop 3D only after interactive, and mobile 3D only on unmetered wifi or a tap", () => {
    const desktopWait = decide3DLoad({ provider: "osm-buildings", viewport: "desktop", interactive: false, connection: unmetered, userRequested: false });
    assert.equal(desktopWait.start, false);
    assert.equal(desktopWait.reason, "wait-until-interactive");
    const desktop = decide3DLoad({ provider: "osm-buildings", viewport: "desktop", interactive: true, connection: metered, userRequested: false });
    assert.equal(desktop.start, true);
    assert.equal(desktop.reason, "desktop-after-interactive");
    const mobileCell = decide3DLoad({ provider: "google-photorealistic", viewport: "mobile", interactive: true, connection: metered, userRequested: false });
    assert.equal(mobileCell.start, false);
    assert.equal(mobileCell.reason, "mobile-needs-tap");
    assert.equal(mobileCell.approximateMegabytes, 10);
    const mobileWifi = decide3DLoad({ provider: "osm-buildings", viewport: "mobile", interactive: true, connection: unmetered, userRequested: false });
    assert.equal(mobileWifi.start, true);
    const tapped = decide3DLoad({ provider: "google-photorealistic", viewport: "mobile", interactive: false, connection: metered, userRequested: true });
    assert.equal(tapped.start, true);
    assert.equal(tapped.reason, "user-requested");
    assert.equal(connectionFromNavigator(null).unmetered, false);
    assert.equal(connectionFromNavigator({ connection: { type: "wifi" } }).unmetered, true);
  });

  it("caps Google tile requests below the measured cold-cache load", () => {
    const desktop = googleTileBudget("desktop");
    const mobile = googleTileBudget("mobile");
    assert.ok(desktop.maxRequests < 450);
    assert.ok(mobile.maxRequests < 185);
    assert.ok(desktop.maxBytes < 26 * 1024 * 1024);
    assert.ok(mobile.maxBytes < 11 * 1024 * 1024);
    assert.ok(desktop.screenSpaceError > 12);
    assert.equal(approximateMegabytes("google-photorealistic", "mobile"), 10);
    assert.equal(V2_FLIGHT_MS >= 600 && V2_FLIGHT_MS <= 900, true);
    assert.equal(GOOGLE_FIRST_TILE_MS, 8_000);
    assert.equal(PHOTO_TILE_TIMEOUT_MS, GOOGLE_FIRST_TILE_MS);
    assert.equal(REACHABILITY_PROBE_MS, 3_000);
    assert.deepEqual(PHOTOREALISTIC_PROBE_URLS, ["https://tile.googleapis.com/", "https://api.cesium.com/"]);
    assert.equal(OVERSEAS_FAILFAST_MS, 6_000);
    assert.equal(providerExternalDomains["osm-buildings"].length, 0);
    assert.equal(providerExternalDomains.aerial.length, 0);
    assert.ok(providerExternalDomains["google-photorealistic"].some((item) => item.host === "tile.googleapis.com"));
    const osm = readFileSync(new URL("../components/v2/map-providers/osm-buildings.ts", import.meta.url), "utf8");
    assert.doesNotMatch(osm, /Cesium|googleapis|overpass|ion\.cesium|defaultAccessToken/i);
    assert.match(osm, /FALLBACK_CITY_MODEL/);
    assert.match(osm, /highlightBuilding/);
    assert.equal(FALLBACK_CITY_MODEL.url, "/v2/manchester-massing.geojson");
    assert.equal(FALLBACK_CITY_MODEL.idProperty, "id");
    const google = readFileSync(new URL("../components/v2/map-providers/google-photorealistic.ts", import.meta.url), "utf8");
    assert.match(google, /defaultAccessToken = ""/);
    assert.match(google, /loaded >= 1/);
    const probe = readFileSync(new URL("../lib/v2/google-reachability.ts", import.meta.url), "utf8");
    assert.match(probe, /new AbortController/);
    assert.match(probe, /method: "HEAD"/);
    assert.doesNotMatch(probe, /key=|access_token|defaultAccessToken/);
    const massing = JSON.parse(readFileSync(new URL("../public/v2/manchester-massing.geojson", import.meta.url), "utf8")) as { features: { id?: string; properties?: { id?: string } }[] };
    assert.equal(massing.features.length, 1193);
    assert.equal(massing.features[0].id, massing.features[0].properties?.id);
    assert.equal(new Set(massing.features.map((feature) => feature.id)).size, massing.features.length);
  });

  it("keeps mainland China on the self-hosted model and allows a dev-only geo override", () => {
    const china = selectMapProvider({ country: "CN", stored: "google-photorealistic", configured: "google-photorealistic", query: "google-photorealistic" });
    assert.equal(china.provider, "osm-buildings");
    assert.equal(china.probeGoogle, false);
    assert.equal(china.reason, "country-cn");
    const chinaAerial = selectMapProvider({ country: "CN", query: "aerial" });
    assert.equal(chinaAerial.provider, "aerial");
    assert.equal(chinaAerial.probeGoogle, false);
    const storedGoogle = selectMapProvider({ country: "GB", stored: "google-photorealistic" });
    assert.equal(storedGoogle.provider, "google-photorealistic");
    assert.equal(storedGoogle.probeGoogle, true);
    assert.equal(selectMapProvider({ country: null }).provider, "osm-buildings");
    assert.equal(selectMapProvider({ country: null }).probeGoogle, false);
    const memory = new Map<string, string>();
    const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
    writeStoredProvider(storage, "osm-buildings");
    assert.equal(readStoredProvider(storage), "osm-buildings");
    assert.equal(memory.get(MAP_PROVIDER_STORAGE_KEY), "osm-buildings");
    assert.equal(geoQueryAllowed({ nodeEnv: "production", overrideFlag: null }), false);
    assert.equal(geoQueryAllowed({ nodeEnv: "production", overrideFlag: "1" }), true);
    assert.equal(geoQueryAllowed({ nodeEnv: "development", overrideFlag: null }), true);
    assert.deepEqual(resolveVisitorCountry({ geoQuery: "cn", cfIpCountry: "GB", cfCountry: "GB", allowGeoQuery: true }), { country: "CN", source: "query" });
    assert.deepEqual(resolveVisitorCountry({ geoQuery: "CN", cfIpCountry: "GB", cfCountry: "GB", allowGeoQuery: false }), { country: "GB", source: "cf" });
    assert.deepEqual(resolveVisitorCountry({ cfIpCountry: "CN", cfCountry: null, allowGeoQuery: false }), { country: "CN", source: "header" });
    assert.deepEqual(resolveVisitorCountry({ cfIpCountry: "XX", cfCountry: "T1", geoQuery: "china", allowGeoQuery: true }), { country: null, source: "unknown" });
  });
});

describe("v2 homes", () => {
  const homes = listings.filter((listing) => listing.cityId === "manchester");
  it("uses real commute minutes and a Chinese place name", () => {
    const home = homes.find((listing) => listing.id === "manchester-1");
    assert.ok(home);
    assert.equal(signpostMinutes(home, null), 9);
    assert.equal(signpostPlace("way/217170181", "zh"), "惠特沃思礼堂");
    assert.equal(SIGNPOST_YELLOW, "#FFC800");
    assert.equal(SIGNPOST_INK, "#15181A");
  });

  it("shows removable chips, a count change, and show-all", () => {
    const prefs = { ...emptyPreferences(), filters: { ...emptyPreferences().filters, budget: 200, walkMinutes: 15 } };
    const chips = preferenceChips(prefs, "zh").map((chip) => chip.label);
    assert.deepEqual(chips, ["≤£200/周", "步行 15 分钟内"]);
    const shown = visibleHomes(homes, prefs);
    assert.match(countChangeLabel(homes.length, shown.length, "zh"), /套 →/);
    const cleared = clearPreferences();
    assert.equal(visibleHomes(homes, cleared).length, homes.length);
    assert.equal(removePreference(prefs, "budget").filters.budget, null);
  });

  it("builds a 3 to 5 home shortlist and an honest comparison", () => {
    const picks = shortlistHomes(homes, { buildingId: "way/217170181", budget: 200, moveIn: "2027-01-15", share: "alone", priority: "commute" }, "zh");
    assert.ok(picks.length >= 3 && picks.length <= 5);
    assert.match(picks[0].reason, /步行|未知/);
    const facts = compareFacts([homes[0].id, homes[1].id], "way/217170181", homes);
    assert.equal(facts[0].deposit, "unknown");
    assert.ok(facts[0].risks.length > 0);
  });

  it("applies an advisor sentence before the model replies", () => {
    const ask = interpretAdvisorText("预算 £200，步行 15 分钟，合租", homes);
    assert.equal(ask.budget, 200);
    assert.equal(ask.walkMinutes, 15);
    assert.equal(ask.share, "shared");
    const next = applyInterpretation(emptyPreferences(), ask);
    assert.equal(next.filters.budget, 200);
    assert.equal(next.shortlistIds, null);
  });

  it("shows a pending stage immediately and rephrase only after 15 seconds", () => {
    const now = advisorPendingCopy(0, 10, "zh");
    assert.match(now.stage, /正在看曼城 10 套房/);
    assert.equal(now.elapsed, "已等 0 秒");
    assert.equal(now.rephrase, false);
    assert.equal(advisorPendingCopy(REPHRASE_AFTER_SECONDS, 10, "zh").rephrase, true);
    assert.equal(REPHRASE_AFTER_SECONDS, 15);
  });
});

describe("v2 signpost paint", () => {
  it("uses yellow only as the signpost background", () => {
    const css = readFileSync(new URL("../app/v2/v2.css", import.meta.url), "utf8");
    const yellows = css.match(/#FFC800/gi) ?? [];
    assert.equal(yellows.length, 1);
    assert.match(css, /background:\s*#FFC800/);
    assert.match(css, /align-items:\s*baseline/);
    assert.match(css, /tabular-nums/);
    assert.match(css, /prefers-reduced-motion[\s\S]*opacity:\s*1 !important/);
    assert.doesNotMatch(css, /color:\s*#FFC800/i);
  });
});
