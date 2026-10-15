import test, {after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import type {RentalSession, AgentStatus} from "../lib/agent/contract";

const directory = mkdtempSync(join(tmpdir(), "atlas-agent-"));
process.env.ATLAS_CHAT_DB = join(directory, "sessions.sqlite");
const {initialRentalState} = await import("../lib/agent/contract");
const {createRentalTools} = await import("../lib/agent/tools");
const {getAmenities, campusCommute, validateRentalState} = await import("../lib/agent/catalog");
const store = await import("../lib/agent/store");
const {cities, listings} = await import("../lib/rental-data");
const {selectAmenities} = await import("../lib/amenity-query");
const {matchesFilters} = await import("../lib/assistant");
const {matchesAmenityCategory} = await import("../lib/amenities");
const {metersBetween} = await import("../lib/walking-route");
const options = {toolCallId: "test", messages: [], context: {}};
async function completed<T>(task: T): Promise<Exclude<Awaited<T>, AsyncIterable<unknown>>> {
  const result = await task;
  if (result && typeof result === "object" && Symbol.asyncIterator in result) throw new Error("This tool must return one final result");
  return result as Exclude<Awaited<T>, AsyncIterable<unknown>>;
}
after(async () => {(await store.database()).close(); rmSync(directory, {recursive: true, force: true});});

test("all supported cities: full nearby count equals displayed marker set, nearest is one, category follow-up preserves radius", async () => {
  for (const city of cities) {
    const initial = initialRentalState(city.id), runtime = createRentalTools(initial), listing = listings.find(l => l.id === initial.listingId)!;
    const data = getAmenities(city.id);
    const result = await completed(runtime.tools.findNearbyAmenities.execute!({category: "convenience", radiusMeters: 1000}, options));
    const independentlyCounted = data.places.filter(p => matchesAmenityCategory(p, "convenience") && metersBetween([listing.lng, listing.lat], [p.lng, p.lat]) <= 1000);
    assert.equal(result.count, independentlyCounted.length);
    assert.equal(result.count, selectAmenities(data, [listing.lng, listing.lat], runtime.getState().map).length);
    assert.ok(result.candidates.length <= 10);
    if (result.count) {
      const nearest = await completed(runtime.tools.focusAmenity.execute!({}, options));
      assert.equal(nearest.id, result.candidates[0].id);
      assert.deepEqual(runtime.getState().map.placeIds, [nearest.id]);
    }
    await runtime.tools.findNearbyAmenities.execute!({category: "supermarket"}, options);
    assert.equal(runtime.getState().map.radiusMeters, 1000);
    assert.equal(runtime.getState().map.placeIds, null);
    assert.equal(runtime.getState().map.routePlaceId, null);
  }
});
test("campus filter uses actual route duration, small client index matches all supported route files", async () => {
  const index = JSON.parse(readFileSync("lib/campus-commutes.json", "utf8"));
  for (const listing of listings) {
    assert.equal(index[listing.id].durationSeconds, campusCommute(listing.id).durationSeconds);
    const state = initialRentalState(listing.cityId); state.filters.walkMinutes = 10;
    assert.equal(matchesFilters(listing, state.filters), campusCommute(listing.id).durationSeconds <= 600);
  }
  const runtime = createRentalTools(initialRentalState("london"));
  const result = await completed(runtime.tools.searchListings.execute!({walkMinutes: 10, budget: 400}, options));
  assert.ok(result.listings.every(l => l.price <= 400 && l.campusWalkMinutes <= 10));
  const converted = await completed(runtime.tools.searchListings.execute!({budget: 2600, budgetPeriod: "month"}, options));
  assert.equal(converted.budget, 600);
  await runtime.tools.searchListings.execute!({clearBudget: true, clearWalkMinutes: true}, options);
  assert.equal(runtime.getState().filters.budget, null);
  assert.equal(runtime.getState().filters.walkMinutes, null);
});
test("unknown facilities/cross-city apartment IDs fail; tool budget limits a turn", async () => {
  const state = initialRentalState("london"); state.map.selectedPlaceId = "node/1";
  assert.throws(() => validateRentalState(state));
  const runtime = createRentalTools(initialRentalState("london"));
  await assert.rejects(Promise.resolve(runtime.tools.selectListing.execute!({listingId: "sydney-1"}, options)));
  await assert.rejects(Promise.resolve(runtime.tools.focusAmenity.execute!({}, options)));
  for (let i = 0; i < 6; i++) await runtime.tools.searchListings.execute!({}, options);
  await assert.rejects(Promise.resolve(runtime.tools.searchListings.execute!({}, options)), /上限/);
});
test("SQLite sessions isolate owners/cities, reject concurrent and stale writes, survive a new process", async () => {
  const alice = store.ownerHash("alice"), bob = store.ownerHash("bob");
  const session = await store.sessionForCity(alice, "london");
  await assert.rejects(() => store.loadSession(bob, session.id));
  assert.notEqual((await store.sessionForCity(alice, "sydney")).id, session.id);
  const acquired = await store.acquireSession(alice, session.id, session.version, session.state);
  await assert.rejects(() => store.acquireSession(alice, session.id, session.version, session.state));
  await store.finishSession(alice, acquired, [{id: "persisted", role: "user", parts: [{type: "text", text: "test"}]}], session.state);
  await assert.rejects(() => store.saveState(alice, session.id, session.version, session.state));
  const output = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `const s=await import('./lib/agent/store.ts'); console.log((await s.loadSession('${alice}','${session.id}')).messages[0].id); (await s.database()).close();`], {encoding: "utf8", env: process.env});
  assert.equal(output.trim(), "persisted");
  const stopped = await store.acquireSession(alice, session.id, acquired.version, session.state);
  await store.finishSession(alice, stopped, [{id: "unfinished", role: "assistant", parts: [{type: "tool-focusAmenity", toolCallId: "orphan", state: "input-available", input: {}}]}], session.state);
  assert.equal((await store.loadSession(alice, session.id)).messages.length, 0, "Unfinished tool calls must not poison the next turn");
});
test("HTTP session/preview guards, same-origin checks, model-not-configured response", async () => {
  const api = await import("../app/api/agent/session/route");
  const preview = await import("../app/api/agent/preview/route");
  const chat = await import("../app/api/agent/chat/route");
  const origin = "http://localhost:5174";
  const get = await api.GET(new Request(`${origin}/api/agent/session?city=london`));
  const cookie = get.headers.get("set-cookie")!.split(";")[0];
  assert.ok(get.headers.get("set-cookie")!.includes("HttpOnly"));
  const {session, status} = await get.json() as {session: RentalSession; status: AgentStatus}; assert.equal(status.configured, false);
  const request = (body: unknown, source = origin) => new Request(`${origin}/api/agent/preview`, {method: "POST", headers: {cookie, origin: source, "Content-Type": "application/json"}, body: JSON.stringify(body)});
  const body = {sessionId: session.id, version: session.version, state: session.state, action: "nearby"};
  assert.equal((await preview.POST(request(body, "https://other.invalid"))).status, 403);
  assert.equal((await preview.POST(request({...body, state: {...body.state, listingId: "sydney-1"}}))).status, 400);
  assert.equal((await preview.POST(request(body))).status, 200);
  const chatRequest = {sessionId: session.id, version: 1, state: session.state, requestId: randomUUID(), message: {id: "text", role: "user", parts: [{type: "text", text: "你好"}]}};
  assert.equal((await chat.POST(request(chatRequest))).status, 503);
  assert.equal((await chat.POST(request({...chatRequest, message: {...chatRequest.message, role: "assistant"}}))).status, 400);
});
test("AI SDK 7 keeps tool history when user language switches independently of UI locale (fixture model, no paid API)", async () => {
  const api = await import("../app/api/agent/session/route"), chat = await import("../app/api/agent/chat/route");
  const originalFetch = globalThis.fetch;
  process.env.ATLAS_AI_BASE_URL = "http://fixture.invalid/v1"; process.env.ATLAS_AI_MODEL = "test-fixture"; process.env.ATLAS_AI_API_KEY = "test-only";
  let modelCalls = 0, historySeen = false;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "http://fixture.invalid/v1/chat/completions"); modelCalls++;
    const body = JSON.parse(String(init?.body));
    // Real compatible gateways can reject the whole request if even an unused
    // tool exposes numeric anyOf/null parameters without a top-level type.
    const search = body.tools.find((t: {function: {name: string}}) => t.function.name === "searchListings").function.parameters;
    assert.equal(search.properties.budget.type, "number");
    assert.equal(search.properties.walkMinutes.type, "integer");
    assert.equal(search.properties.clearBudget.type, "boolean");
    const lastUser = body.messages.findLast((m: {role: string}) => m.role === "user");
    const last = body.messages.at(-1);
    const nearest = String(lastUser.content).includes("nearest");
    const instructions = body.messages.find((m: {role:string}) => m.role === "system").content;
    assert.ok(instructions.includes("根据最新一条用户消息的主要语言回复"));
    assert.ok(instructions.includes("不受界面语言、历史回复或工具标签语言影响"));
    assert.ok(!instructions.includes("即使历史对话或工具标签为中文"), "UI locale must not force the response language");
    if (nearest) historySeen = body.messages.some((m: {role: string}) => m.role === "tool");
    const delta = last.role === "tool" ? {content: nearest ? "The nearest store is now shown on the map." : "已根据工具结果同步地图。"} : {tool_calls: [{index: 0, id: randomUUID(), type: "function", function: {name: nearest ? "focusAmenity" : "findNearbyAmenities", arguments: JSON.stringify(nearest ? {} : {category: "convenience", radiusMeters: 500})}}]};
    const chunk = (delta: unknown, reason: string | null) => `data: ${JSON.stringify({id: "fixture", object: "chat.completion.chunk", created: 1, model: "test-fixture", choices: [{index: 0, delta, finish_reason: reason}]})}\n\n`;
    return new Response(chunk(delta, null) + chunk({}, last.role === "tool" ? "stop" : "tool_calls") + "data: [DONE]\n\n", {headers: {"Content-Type": "text/event-stream"}});
  };
  try {
    const origin = "http://localhost:5174";
    const loaded = await api.GET(new Request(`${origin}/api/agent/session?city=london`));
    const cookie = loaded.headers.get("set-cookie")!.split(";")[0];
    let {session} = await loaded.json() as {session: RentalSession};
    for (const {text, locale, expected} of [
      {text: "附近500米内有几个便利店", locale: "en", expected: "已根据工具结果同步地图"},
      {text: "Show only the nearest one.", locale: "zh", expected: "The nearest store is now shown on the map."},
    ]) {
      const response = await chat.POST(new Request(`${origin}/api/agent/chat`, {method: "POST", headers: {cookie, origin, "Content-Type": "application/json"}, body: JSON.stringify({locale, sessionId: session.id, version: session.version, state: session.state, requestId: randomUUID(), message: {id: randomUUID(), role: "user", parts: [{type: "text", text}]}})}));
      assert.equal(response.status, 200);
      const sse = await response.text();
      assert.ok(sse.includes('"type":"data-rental-state"'));
      assert.ok(sse.includes(expected), sse);
      assert.ok(!sse.includes('"type":"error"'), sse);
      session = await store.loadSession(store.ownerHash(cookie.split("=")[1]), session.id);
    }
    assert.deepEqual(session.messages.findLast(message=>message.role==="user")?.metadata?.context,{cityId:"london",listingId:session.state.listingId});
    assert.deepEqual(session.messages.at(-1)?.metadata?.context,{cityId:"london",listingId:session.state.listingId});
    assert.ok(historySeen); assert.equal(modelCalls, 4);
    assert.equal(session.state.map.placeIds!.length, 1);
    assert.equal(session.messages.filter((m: {role: string}) => m.role === "user").length, 2);
  } finally {globalThis.fetch = originalFetch; delete process.env.ATLAS_AI_BASE_URL; delete process.env.ATLAS_AI_MODEL; delete process.env.ATLAS_AI_API_KEY;}
});

test("a model timeout is visible after refresh and retry answers the same user turn without duplication", async () => {
  const api = await import("../app/api/agent/session/route"), chat = await import("../app/api/agent/chat/route");
  const originalFetch = globalThis.fetch, originalTimeout = AbortSignal.timeout;
  process.env.ATLAS_AI_BASE_URL = "http://fixture.invalid/v1"; process.env.ATLAS_AI_MODEL = "test-fixture"; process.env.ATLAS_AI_API_KEY = "test-only";
  AbortSignal.timeout = () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("Test deadline", "TimeoutError")), 30);
    return controller.signal;
  };
  globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) reject(signal.reason);
    else signal?.addEventListener("abort", () => reject(signal.reason), {once: true});
  });
  try {
    const origin = "http://localhost:5174";
    const loaded = await api.GET(new Request(`${origin}/api/agent/session?city=london`));
    const cookie = loaded.headers.get("set-cookie")!.split(";")[0];
    let {session} = await loaded.json() as {session: RentalSession};
    const message = {id: randomUUID(), role: "user", parts: [{type: "text", text: "每周500以内，步行30分钟内，有什么推荐？"}]};
    const request = (retry = false) => new Request(`${origin}/api/agent/chat`, {method: "POST", headers: {cookie, origin, "Content-Type": "application/json"}, body: JSON.stringify({sessionId: session.id, version: session.version, state: session.state, requestId: randomUUID(), message, retry})});
    const response = await chat.POST(request());
    const sse = await response.text();
    assert.ok(sse.includes('"type":"error"'), "Deadline must be an error, not a silent abort: " + sse);
    assert.ok(sse.includes("回复超时"), sse);
    session = await store.loadSession(store.ownerHash(cookie.split("=")[1]), session.id);
    assert.equal((session.messages.at(-1)?.metadata as {replyStatus?: string})?.replyStatus, "timeout", "Failure must survive refresh");

    AbortSignal.timeout = originalTimeout;
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.messages.filter((m: {role: string}) => m.role === "user").length, 1);
      const last = body.messages.at(-1);
      const delta = last.role === "tool" ? {content: "已筛选每周500以内、步行30分钟内的演示公寓。"} : {tool_calls: [{index: 0, id: randomUUID(), type: "function", function: {name: "searchListings", arguments: JSON.stringify({budget: 500, walkMinutes: 30})}}]};
      const chunk = (delta: unknown, reason: string | null) => `data: ${JSON.stringify({id: "fixture", object: "chat.completion.chunk", created: 1, model: "test-fixture", choices: [{index: 0, delta, finish_reason: reason}]})}\n\n`;
      return new Response(chunk(delta, null) + chunk({}, last.role === "tool" ? "stop" : "tool_calls") + "data: [DONE]\n\n", {headers: {"Content-Type": "text/event-stream"}});
    };
    const retried = await chat.POST(request(true));
    const retrySSE = await retried.text();
    assert.ok(retrySSE.includes("已筛选"), retrySSE);
    session = await store.loadSession(store.ownerHash(cookie.split("=")[1]), session.id);
    assert.equal(session.messages.filter(m => m.role === "user").length, 1);
    assert.equal(session.state.filters.budget, 500);
    assert.equal(session.state.filters.walkMinutes, 30);
    assert.equal((session.messages.at(-1)?.metadata as {replyStatus?: string})?.replyStatus, undefined);
  } finally {
    globalThis.fetch = originalFetch; AbortSignal.timeout = originalTimeout;
    delete process.env.ATLAS_AI_BASE_URL; delete process.env.ATLAS_AI_MODEL; delete process.env.ATLAS_AI_API_KEY;
  }
});

test("provider failure, empty completion and an explicit stop all retain a retryable turn", async () => {
  const api = await import("../app/api/agent/session/route"), chat = await import("../app/api/agent/chat/route");
  const {retryableMessage} = await import("../lib/agent/conversation");
  const originalFetch = globalThis.fetch;
  process.env.ATLAS_AI_BASE_URL = "http://fixture.invalid/v1"; process.env.ATLAS_AI_MODEL = "test-fixture"; process.env.ATLAS_AI_API_KEY = "test-only";
  try {
    for (const scenario of ["provider-error", "empty", "stop"] as const) {
      const origin = "http://localhost:5174", controller = new AbortController();
      globalThis.fetch = async (_input, init) => {
        if (scenario === "provider-error") return new Response(JSON.stringify({error: {message: "fixture upstream failure"}}), {status: 503, headers: {"Content-Type": "application/json"}});
        if (scenario === "stop") return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) reject(signal.reason);
          else signal?.addEventListener("abort", () => reject(signal.reason), {once: true});
          setTimeout(() => controller.abort(), 30);
        });
        return new Response(`data: ${JSON.stringify({id: "fixture", object: "chat.completion.chunk", created: 1, model: "test-fixture", choices: [{index: 0, delta: {}, finish_reason: "stop"}]})}\n\ndata: [DONE]\n\n`, {headers: {"Content-Type": "text/event-stream"}});
      };
      const loaded = await api.GET(new Request(`${origin}/api/agent/session?city=london`));
      const cookie = loaded.headers.get("set-cookie")!.split(";")[0];
      const {session} = await loaded.json() as {session: RentalSession};
      const message = {id: randomUUID(), role: "user", parts: [{type: "text", text: "推荐公寓"}]};
      const response = await chat.POST(new Request(`${origin}/api/agent/chat`, {method: "POST", signal: controller.signal, headers: {cookie, origin, "Content-Type": "application/json"}, body: JSON.stringify({sessionId: session.id, version: session.version, state: session.state, requestId: randomUUID(), message})}));
      const sse = await response.text();
      const restored = await store.loadSession(store.ownerHash(cookie.split("=")[1]), session.id);
      assert.equal(restored.messages.at(-1)?.metadata?.replyStatus, scenario === "stop" ? "stopped" : "error", sse);
      assert.equal(retryableMessage(restored.messages)?.id, message.id);
      assert.equal(sse.includes('"type":"error"'), scenario !== "stop", "An explicit stop must not be reported as a model failure");
    }
    const legacy = [{id: "user", role: "user", parts: [{type: "text", text: "预算500"}]}, {id: "partial", role: "assistant", parts: [{type: "text", text: "部分回复", state: "streaming"}]}] as RentalSession["messages"];
    assert.equal(retryableMessage(legacy)?.id, "user", "A legacy partial reply must be recoverable after refresh");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ATLAS_AI_BASE_URL; delete process.env.ATLAS_AI_MODEL; delete process.env.ATLAS_AI_API_KEY;
  }
});
