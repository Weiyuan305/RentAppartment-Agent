import test, {after} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Miniflare} from "miniflare";
import {createStore, SessionError} from "../lib/agent/store";
import {d1Database} from "../lib/agent/database-d1";

const directory = mkdtempSync(join(tmpdir(), "atlas-d1-"));
const createRuntime = () => new Miniflare({modules: true, script: "export default {fetch() {return new Response('ok')}}", compatibilityDate: "2026-05-15", d1Databases: {ATLAS_DB: "atlas-test"}, d1Persist: directory, cf: false});
let runtime = createRuntime();
let binding = await runtime.getD1Database("ATLAS_DB");
const migration = readFileSync("migrations/0001_rental.sql", "utf8");
await binding.batch(migration.split(";").filter(s => s.trim()).map(sql => binding.prepare(sql)));
const store = createStore(async () => d1Database(binding as unknown as D1Database));
after(async () => {await runtime.dispose(); rmSync(directory, {recursive: true, force: true});});

test("real D1: owners and cities stay isolated; concurrent and stale turns cannot overwrite", async () => {
  const session = await store.sessionForCity("alice", "london");
  const duplicates = await Promise.all(Array.from({length: 4}, () => store.sessionForCity("alice", "london")));
  assert.ok(duplicates.every(s => s.id === session.id));
  await assert.rejects(store.loadSession("bob", session.id), e => e instanceof SessionError && e.status === 404);
  assert.notEqual((await store.sessionForCity("alice", "sydney")).id, session.id);
  const competing = await Promise.allSettled([store.acquireSession("alice", session.id, 0, session.state), store.acquireSession("alice", session.id, 0, session.state)]);
  assert.equal(competing.filter(r => r.status === "fulfilled").length, 1);
  const first = competing.find(r => r.status === "fulfilled")!;
  assert.equal(first.status, "fulfilled");
  if (first.status !== "fulfilled") throw new Error("No lease acquired");
  await store.finishSession("alice", first.value, [{id: "question", role: "user", parts: [{type: "text", text: "附近有几家便利店？"}]}], session.state);
  const next = await store.acquireSession("alice", session.id, first.value.version, {...session.state, listingId: "london-2"});
  await store.finishSession("alice", next, [...next.messages, {id: "failure", role: "assistant", metadata: {replyStatus: "timeout"}, parts: []}], next.state);
  await store.finishSession("alice", first.value, [], session.state);
  const restored = await store.loadSession("alice", session.id);
  assert.equal(restored.state.listingId, "london-2");
  assert.equal(restored.messages.length, 2);
  assert.equal(restored.messages[1].metadata?.replyStatus, "timeout");
  await assert.rejects(store.saveState("alice", session.id, 0, session.state), /刷新/);
});

test("real D1: quota is atomic under concurrent requests and resets only after expiry", async () => {
  const attempts = await Promise.allSettled(Array.from({length: 12}, () => store.consumeQuota("shared-budget", 3, 60000)));
  assert.equal(attempts.filter(r => r.status === "fulfilled").length, 3);
  assert.ok(attempts.filter(r => r.status === "rejected").every(r => r.status === "rejected" && r.reason.status === 429));
  const before = await binding.prepare("SELECT count FROM quotas WHERE key=?").bind("shared-budget").first<{count: number}>();
  assert.equal(before?.count, 3);
  await binding.prepare("UPDATE quotas SET expires=0 WHERE key=?").bind("shared-budget").run();
  await store.consumeQuota("shared-budget", 3, 60000);
  const reset = await binding.prepare("SELECT count FROM quotas WHERE key=?").bind("shared-budget").first<{count: number}>();
  assert.equal(reset?.count, 1);
});

test("real D1: conversation and route cache survive a fresh Worker runtime", async () => {
  const session = await store.sessionForCity("alice", "london");
  await binding.prepare("INSERT INTO routes (key,payload,expires) VALUES (?,?,?)").bind("london-2:fixture", '{"source":"fixture"}', Date.now() + 60000).run();
  await runtime.dispose();
  runtime = createRuntime();
  binding = await runtime.getD1Database("ATLAS_DB");
  const restored = await store.loadSession("alice", session.id);
  assert.equal(restored.messages[0].id, "question");
  assert.equal(restored.state.listingId, "london-2");
  assert.ok(await binding.prepare("SELECT payload FROM routes WHERE key=?").bind("london-2:fixture").first());
});
