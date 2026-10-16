import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { createStore, SessionError } from "../lib/agent/store";
import { d1Database } from "../lib/agent/database-d1";

const directory = mkdtempSync(join(tmpdir(), "atlas-d1-"));
const createRuntime = () =>
  new Miniflare({
    modules: true,
    script: "export default {fetch() {return new Response('ok')}}",
    compatibilityDate: "2026-05-15",
    d1Databases: { ATLAS_DB: "atlas-test" },
    d1Persist: directory,
    cf: false,
  });
let runtime = createRuntime();
let binding = await runtime.getD1Database("ATLAS_DB");
const migration = readFileSync("migrations/0001_rental.sql", "utf8");
await binding.batch(
  migration
    .split(";")
    .filter((s) => s.trim())
    .map((sql) => binding.prepare(sql)),
);
const store = createStore(async () =>
  d1Database(binding as unknown as D1Database),
);
after(async () => {
  await runtime.dispose();
  rmSync(directory, { recursive: true, force: true });
});

test("real D1: owners and cities stay isolated; concurrent and stale turns cannot overwrite", async () => {
  const session = await store.sessionForCity("alice", "london");
  const duplicates = await Promise.all(
    Array.from({ length: 4 }, () => store.sessionForCity("alice", "london")),
  );
  assert.ok(duplicates.every((s) => s.id === session.id));
  await assert.rejects(
    store.loadSession("bob", session.id),
    (e) => e instanceof SessionError && e.status === 404,
  );
  assert.notEqual(
    (await store.sessionForCity("alice", "sydney")).id,
    session.id,
  );
  const competing = await Promise.allSettled([
    store.acquireSession("alice", session.id, 0, session.state),
    store.acquireSession("alice", session.id, 0, session.state),
  ]);
  assert.equal(competing.filter((r) => r.status === "fulfilled").length, 1);
  const first = competing.find((r) => r.status === "fulfilled")!;
  assert.equal(first.status, "fulfilled");
  if (first.status !== "fulfilled") throw new Error("No lease acquired");
  await store.finishSession(
    "alice",
    first.value,
    [
      {
        id: "question",
        role: "user",
        parts: [{ type: "text", text: "附近有几家便利店？" }],
      },
    ],
    session.state,
  );
  const next = await store.acquireSession(
    "alice",
    session.id,
    first.value.version,
    { ...session.state, listingId: "london-2" },
  );
  await store.finishSession(
    "alice",
    next,
    [
      ...next.messages,
      {
        id: "failure",
        role: "assistant",
        metadata: { replyStatus: "timeout" },
        parts: [],
      },
    ],
    next.state,
  );
  await store.finishSession("alice", first.value, [], session.state);
  const restored = await store.loadSession("alice", session.id);
  assert.equal(restored.state.listingId, "london-2");
  assert.equal(restored.messages.length, 2);
  assert.equal(restored.messages[1].metadata?.replyStatus, "timeout");
  await assert.rejects(
    store.saveState("alice", session.id, 0, session.state),
    /刷新/,
  );
});

test("real D1: quota is atomic under concurrent requests and resets only after expiry", async () => {
  const attempts = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      store.consumeQuota("shared-budget", 3, 60000),
    ),
  );
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 3);
  assert.ok(
    attempts
      .filter((r) => r.status === "rejected")
      .every((r) => r.status === "rejected" && r.reason.status === 429),
  );
  const before = await binding
    .prepare("SELECT count FROM quotas WHERE key=?")
    .bind("shared-budget")
    .first<{ count: number }>();
  assert.equal(before?.count, 3);
  await binding
    .prepare("UPDATE quotas SET expires=0 WHERE key=?")
    .bind("shared-budget")
    .run();
  await store.consumeQuota("shared-budget", 3, 60000);
  const reset = await binding
    .prepare("SELECT count FROM quotas WHERE key=?")
    .bind("shared-budget")
    .first<{ count: number }>();
  assert.equal(reset?.count, 1);
});

test("real D1: conversation and route cache survive a fresh Worker runtime", async () => {
  const session = await store.sessionForCity("alice", "london");
  await binding
    .prepare("INSERT INTO routes (key,payload,expires) VALUES (?,?,?)")
    .bind("london-2:fixture", '{"source":"fixture"}', Date.now() + 60000)
    .run();
  await runtime.dispose();
  runtime = createRuntime();
  binding = await runtime.getD1Database("ATLAS_DB");
  const restored = await store.loadSession("alice", session.id);
  assert.equal(restored.messages[0].id, "question");
  assert.equal(restored.state.listingId, "london-2");
  assert.ok(
    await binding
      .prepare("SELECT payload FROM routes WHERE key=?")
      .bind("london-2:fixture")
      .first(),
  );
});

test("real D1: merchant publication, private media, revision and route summaries", async () => {
  const { createMerchantService } = await import("../lib/merchant/service");
  const { newProperty } = await import("../lib/merchant/model");
  const { randomUUID } = await import("node:crypto");
  for (const file of [
    "0002_auth.sql",
    "0003_personal_library.sql",
    "0004_merchant.sql",
    "0005_merchant_preferences.sql",
  ]) {
    const sql = readFileSync(`migrations/${file}`, "utf8").replace(
      /^--.*$/gm,
      "",
    );
    await binding.batch(
      sql
        .split(";")
        .filter((s) => s.trim())
        .map((s) => binding.prepare(s)),
    );
  }
  const db = d1Database(binding as unknown as D1Database),
    s = createMerchantService(db),
    host = { id: "d1-host", admin: false },
    admin = { id: "d1-admin", admin: true };
  await db.run(
    "INSERT INTO auth_user (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,0,0,0)",
    [host.id, "Host", "d1-host@example.test"],
  );
  await s.command(host, {
    kind: "apply",
    version: 0,
    profile: {
      name: "D1 host",
      kind: "landlord",
      contact: "private@example.test",
      cities: ["london"],
      evidence: "Private review material only",
    },
  });
  const m = (await s.mine(host))!;
  await s.command(admin, {
    kind: "reviewMerchant",
    id: m.id,
    version: 0,
    approve: true,
    reason: "Local test reviewed",
  });
  await s.command(host,{kind:"setCity",cityId:"melbourne"});
  assert.equal((await createMerchantService(db).mine(host))!.defaultCityId,"melbourne");
  const {createAddressSearch}=await import("../lib/merchant/geocoding");
  let upstream=0;
  const query={cityId:"london",address:"Gower Street",postcode:"",locale:"en"};
  const results=await Promise.allSettled([1,2].map(n=>createAddressSearch(db,async()=>{upstream++;return Response.json([]);})({...query,address:query.address+n},host.id)));
  assert.equal(upstream,1);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  const photo = randomUUID();
  await db.run("INSERT INTO merchant_media VALUES (?,?,?,?,?,?)", [
    photo,
    m.id,
    "image/jpeg",
    "test",
    4,
    Date.now(),
  ]);
  const draft = {
    ...newProperty(),
    name: "D1 campus home",
    area: "Bloomsbury",
    address: "20 Test Street London",
    lng: -0.13,
    lat: 51.52,
    entranceConfirmed: true,
    description: "D1 integration test fixture, never a real listing",
    guarantor: "None",
    paymentTerms: "Monthly",
    cancellation: "Confirm terms",
    photos: [photo],
    floorPlans: [photo],
  };
  Object.assign(draft.rooms[0], {
    name: "Studio",
    billDetails: "Included",
    availableFrom: "2027-01-01",
    availableUntil: "2028-01-01",
  });
  const { id } = await s.command(host, { kind: "save", version: 0, draft });
  await s.command(host, { kind: "submit", id, version: 0 });
  await s.command(admin, {
    kind: "reviewProperty",
    id,
    version: 1,
    approve: true,
    reason: "Local test approved",
  });
  const home = (await s.catalogue()).find((l) => l.merchant)!;
  assert.equal(home.merchant?.floorPlans?.length, 1);
  assert.ok(!JSON.stringify(home).includes("private@example.test"));
  const { getCity } = await import("../lib/rental-data");
  const city = getCity("london");
  await db.run("INSERT INTO routes VALUES (?,?,?)", [
    `${home.id}:test`,
    JSON.stringify({
      listingId: home.id,
      origin: [home.lng, home.lat],
      destination: [city.lng, city.lat],
      amenityId: "university:london",
      durationSeconds: 600,
      distanceMeters: 700,
      coordinates: [[1, 2]],
      source: { engine: "OSRM" },
    }),
    Date.now() + 60000,
  ]);
  const enriched = (await s.catalogue()).find((l) => l.id === home.id)!;
  assert.equal(enriched.merchant?.commutes?.university.durationSeconds, 600);
  assert.ok(!JSON.stringify(enriched).includes("coordinates"));
  const used = await db.first<{ used: number }>(
    "SELECT EXISTS(SELECT 1 FROM properties WHERE draft LIKE ? OR published LIKE ?) AS used",
    [`%\"${photo}\"%`, `%\"${photo}\"%`],
  );
  assert.equal(used?.used, 1);
  await s.command(host, {
    kind: "save",
    id,
    version: 2,
    draft: { ...draft, name: "Unreviewed revision" },
  });
  assert.equal(
    (await s.catalogue()).find((l) => l.id === home.id)?.name,
    home.name,
  );
  await s.command(admin, {
    kind: "takedown",
    id,
    version: 3,
    reason: "End of local test",
  });
  assert.ok(!(await s.catalogue()).some((l) => l.id === home.id));
});
