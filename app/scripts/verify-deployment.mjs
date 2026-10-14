import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";

const nativeFetch = globalThis.fetch;
const fetch = (input, init = {}) => nativeFetch(input, {...init, headers: {Connection: "close", ...init.headers}, signal: init.signal ?? AbortSignal.timeout(30000)});

const origin = new URL(process.argv[2] || "http://127.0.0.1:5180").origin;
const withModel = process.argv.includes("--model");
const storage = process.argv.find(arg => arg.startsWith("--storage="))?.split("=")[1];
let cookie = "";
const report = {origin, checkedAt: new Date().toISOString(), cities: [], model: []};
async function getSession(city) {
  const response = await fetch(`${origin}/api/agent/session?city=${city}`, {headers: {cookie}});
  assert.equal(response.status, 200, `session ${city}: ${awaitError(response)}`);
  cookie ||= response.headers.get("set-cookie")?.split(";")[0] || "";
  const result = await response.json();
  if (storage) assert.ok(result.status.storage.startsWith(storage), result.status.storage);
  return result;
}
function awaitError(response) {return `${response.status} ${response.statusText}`;}
async function post(path, body, source = origin, method = "POST") {
  return fetch(origin + path, {method, headers: {cookie, origin: source, "Content-Type": "application/json"}, body: JSON.stringify(body), signal: AbortSignal.timeout(110000)});
}
const health = await fetch(origin + "/api/health");
assert.equal(health.status, 200, "backend health must be HTTP 200");
assert.equal(health.headers.get("cache-control"), "no-store");
assert.equal(health.headers.get("set-cookie"), null, "monitoring must not create an anonymous session");
report.health = await health.json();
assert.equal(report.health.status, "ok");
const page = await fetch(origin + "/?city=london&listing=london-2");
assert.equal(page.status, 200); assert.ok((await page.text()).includes("远居"));
for (const city of ["london", "sydney", "singapore", "kuala-lumpur", "hong-kong"]) {
  console.error(`Checking ${city}: session and map tools`);
  let {session} = await getSession(city);
  for (const action of ["nearby", "commute"]) {
    const response = await post("/api/agent/preview", {sessionId: session.id, version: session.version, state: session.state, action});
    assert.equal(response.status, 200, `${city} ${action}: ${awaitError(response)}`);
    session = (await response.json()).session;
    if (action === "nearby") assert.deepEqual(session.state.map.categories, ["convenience"]);
    if (action === "commute") assert.equal(session.state.map.campusRoute, true);
  }
  assert.deepEqual((await getSession(city)).session, session, "refresh restores messages and map state");
  const asset = await fetch(`${origin}/amenities/${city}.json`); assert.equal(asset.status, 200);
  assert.ok((await asset.json()).places.length > 0);
  const campus = await fetch(`${origin}/routes/${session.state.listingId}.json`); assert.equal(campus.status, 200);
  assert.ok((await campus.json()).coordinates.length > 1);
  report.cities.push({city, tools: ["nearby", "campus-route"], persistence: true});
  console.error(`PASS ${city}: tools, persistence and static snapshots`);
}
let {session, status} = await getSession("london");
const body = {sessionId: session.id, version: session.version, state: session.state, action: "nearby"};
assert.equal((await post("/api/agent/preview", body, "https://other.invalid")).status, 403);
assert.equal((await post("/api/agent/preview", {...body, state: {...body.state, listingId: "sydney-1"}})).status, 400);
const other = await (await fetch(`${origin}/api/agent/session?city=london`)).json();
assert.notEqual(other.session.id, session.id, "different browser gets a different conversation");
if (withModel) {
  assert.equal(status.configured, true, "server model secrets must be configured");
  for (const text of ["我当前公寓直线500米内有几家便利店？请在地图上显示。", "只显示刚才查询结果中最近的一家。"]) {
    const started = Date.now();
    const response = await post("/api/agent/chat", {sessionId: session.id, version: session.version, state: session.state, requestId: randomUUID(), message: {id: randomUUID(), role: "user", parts: [{type: "text", text}]}});
    assert.equal(response.status, 200);
    const sse = await response.text();
    const chunks = sse.split("\n").filter(line => line.startsWith("data: ") && line !== "data: [DONE]").map(line => JSON.parse(line.slice(6)));
    assert.ok(chunks.some(c => c.type === "data-rental-state" && c.data.phase === "update"), "model called a map tool");
    assert.ok(!chunks.some(c => c.type === "error"), "model stream completed without an error");
    const reply = chunks.filter(c => c.type === "text-delta").map(c => c.delta).join("");
    assert.ok(reply.trim(), "model returned readable text");
    session = (await getSession("london")).session;
    assert.equal(session.messages.at(-1).role, "assistant");
    assert.ok(!session.messages.at(-1).metadata?.replyStatus);
    report.model.push({question: text, reply, elapsedMs: Date.now() - started});
  }
  assert.equal(session.state.map.placeIds.length, 1);
  const place = session.state.map.selectedPlaceId;
  const response = await fetch(`${origin}/api/amenity-route?city=london&listing=${session.state.listingId}&place=${encodeURIComponent(place)}`);
  assert.equal(response.status, 200, "real walking route service responds");
  const route = await response.json();
  assert.equal(route.source.engine, "OSRM"); assert.ok(route.coordinates.length > 1);
  report.route = {engine: route.source.engine, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, points: route.coordinates.length};
}
console.log(JSON.stringify(report, null, 2));
