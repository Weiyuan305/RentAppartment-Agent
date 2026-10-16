import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDatabase } from "../lib/agent/database-sqlite";
import { createAddressSearch, addressResults } from "../lib/merchant/geocoding";
import {
  newProperty,
  propertySchema,
  publicListings,
} from "../lib/merchant/model";
const row = {
  lat: "51.5246",
  lon: "-0.134",
  display_name: "Gower Street, London",
  osm_type: "way",
  osm_id: 12,
  addresstype: "road",
  address: { country_code: "gb", postcode: "WC1E 6BT", suburb: "Bloomsbury" },
};
test("address candidates reject wrong countries, missing coordinates and distant matches", () => {
  const r = addressResults(
    [
      row,
      { ...row, address: { country_code: "au" } },
      { ...row, lat: null },
      { ...row, lat: "55" },
      { ...row, addresstype: "postcode" },
    ],
    "london",
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].precision, "street");
  assert.equal(r[1].precision, "area");
  assert.equal(
    addressResults(
      [{ ...row, address: { ...row.address, house_number: "20" } }],
      "london",
    )[0].precision,
    "building",
  );
});
test("city defaults keep legacy drafts compatible and expose the saved postcode", () => {
  const p = newProperty("singapore");
  assert.equal(p.cityId, "singapore");
  assert.equal(p.rooms[0].period, "month");
  const { postcode, locationSource, ...legacy } = newProperty();
  assert.equal(postcode, "");
  assert.equal(locationSource, null);
  assert.equal(propertySchema.parse(legacy).postcode, "");
  p.address = "20 Test Street";
  p.postcode = "123456";
  const record = {
    id: "m_test",
    merchant: "host",
    draft: p,
    published: p,
    status: "approved" as const,
    reason: "",
    version: 1,
    updated: 1,
    publishedAt: 1,
  };
  assert.equal(
    publicListings(record, "Host")[0].merchant!.address,
    "20 Test Street, 123456",
  );
});
test("address service caches, serializes upstream calls globally and never fabricates a match", async () => {
  const dir = mkdtempSync(join(tmpdir(), "atlas-address-"));
  process.env.ATLAS_CHAT_DB = join(dir, "test.sqlite");
  const db = await getDatabase();
  let calls = 0,
    release: () => void = () => {};
  const query = {
    cityId: "london",
    address: "Gower Street",
    postcode: "WC1E 6BT",
    locale: "en",
  };
  const pending = new Promise<void>((r) => {
    release = r;
  });
  const request: typeof fetch = async (input, init) => {
    calls++;
    const url = new URL(input.toString());
    assert.equal(url.searchParams.get("countrycodes"), "gb");
    assert.match(new Headers(init?.headers).get("User-Agent")!, /CampusAtlas/);
    await pending;
    return Response.json([row]);
  };
  try {
    const one = createAddressSearch(db, request)(query, "host1");
    // Await the durable lease, not a fixed timer, before simulating a second instance.
    for (let i = 0; i < 20 && calls === 0; i++)
      await new Promise((r) => setImmediate(r));
    assert.equal(calls, 1);
    await assert.rejects(
      createAddressSearch(db, request)(
        { ...query, address: "Other Street" },
        "host2",
      ),
      /busy/,
    );
    release();
    const first = await one;
    assert.equal(first.results.length, 1);
    assert.deepEqual(
      await createAddressSearch(db, request)(
        { ...query, address: "gower  street", postcode: "wc1e6bt" },
        "host2",
      ),
      first,
    );
    assert.equal(calls, 1);
    await assert.rejects(
      createAddressSearch(db, request)(
        { ...query, address: "Other Street" },
        "host2",
      ),
      /busy/,
    );
    await db.run("DELETE FROM quotas WHERE key='address:upstream'");
    const empty = await createAddressSearch(db, async () => Response.json([]))(
      { ...query, address: "No Such Address" },
      "host1",
    );
    assert.deepEqual(empty.results, []);
    await db.run("DELETE FROM quotas WHERE key='address:upstream'");
    await assert.rejects(
      createAddressSearch(
        db,
        async () => new Response("Unavailable", { status: 503 }),
      )({ ...query, address: "Error Address" }, "host1"),
      /unavailable/,
    );
    await assert.rejects(
      createAddressSearch(db, request)(
        { ...query, address: "", postcode: "" },
        "host1",
      ),
    );
  } finally {
    release();
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
