import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {schema, type RentalDatabase} from "../lib/agent/database";
import {healthResponse} from "../lib/health";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(schema);
  const database: RentalDatabase = {
    kind: "SQLite",
    async first<T>(sql: string) {return sqlite.prepare(sql).get() as T | undefined ?? null;},
    async all<T>(sql: string) {return sqlite.prepare(sql).all() as T[];},
    async run() {throw new Error("Health checks must not write");},
    close() {sqlite.close();},
  };
  return {sqlite, database, deps: {database: async () => database, aiConfigured: () => true}};
}

test("health: a migrated database is healthy without creating sessions or consuming quotas", async () => {
  const {sqlite, database, deps} = fixture();
  try {
    const response = await healthResponse(deps);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.deepEqual(await response.json(), {status: "ok", checks: {database: "ok", aiConfiguration: "ok"}});
    for (const table of ["sessions", "quotas", "routes"]) {
      assert.equal(sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count, 0);
    }
  } finally {database.close();}
});

test("health: missing migrations, unavailable database or missing model configuration return 503", async () => {
  const {sqlite, database, deps} = fixture();
  try {
    assert.equal((await healthResponse({...deps, aiConfigured: () => false})).status, 503);
    sqlite.exec("DROP TABLE sessions");
    assert.equal((await healthResponse(deps)).status, 503);
    const response = await healthResponse({...deps, database: async () => {throw new Error("private connection detail");}});
    assert.equal(response.status, 503);
    assert.equal((await response.text()).includes("private connection detail"), false);
  } finally {database.close();}
});
