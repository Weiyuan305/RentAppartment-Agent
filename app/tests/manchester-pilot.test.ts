import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { defaultCityId, listingVerification, listings } from "../lib/rental-data";
import { campusCommuteEstimate } from "../lib/campus-commute-estimate";
import { englishRoomReply, roomTypeReplyRule } from "../lib/assistant-language";
import { schema, type RentalDatabase } from "../lib/agent/database";
import { insertViewingRequest } from "../lib/viewing-requests";
import { initialRentalState } from "../lib/agent/contract";
import { createRentalTools } from "../lib/agent/tools";

test("Manchester is the first-visit city and demo homes stay unverified", () => {
  assert.equal(defaultCityId, "manchester");
  const homes = listings.filter(home => home.cityId === "manchester");
  assert.equal(homes.length, 10);
  for (const area of ["Fallowfield", "Victoria Park", "Rusholme", "City centre"]) {
    assert.ok(homes.some(home => home.area === area), area);
  }
  for (const home of homes.filter(home => !home.merchant)) assert.equal(listingVerification(home), "pending");
  assert.deepEqual(listings.filter(home => home.id.startsWith("manchester-")).map(home => home.id), [
    "manchester-1", "manchester-2", "manchester-3", "manchester-4", "manchester-5", "manchester-6", "manchester-7", "manchester-8", "manchester-9", "manchester-10",
  ]);
});

test("campus commute estimates walk from the road network and labels cycle and bus", () => {
  const home = listings.find(item => item.id === "manchester-1")!;
  const estimate = campusCommuteEstimate(home);
  assert.equal(estimate.walk.minutes, 9);
  assert.equal(estimate.distanceMeters, 720);
  assert.equal(estimate.cycle.minutes, 3);
  assert.equal(estimate.bus.minutes, 11);
  assert.equal(estimate.walkBasis, "road-network");
  assert.equal(estimate.estimate, true);
});

test("English assistant replies drop Chinese room types", () => {
  assert.equal(englishRoomReply("Shared room (合租单间)"), "Shared room");
  assert.equal(englishRoomReply("A 合租单间 near campus"), "A Shared apartment room near campus");
  assert.equal(englishRoomReply("Private room（独卫单间）"), "Private room");
  assert.equal(englishRoomReply("独立 Studio"), "Private studio");
  assert.doesNotMatch(englishRoomReply("Shared room (合租单间) and 独卫单间"), /[\u4e00-\u9fff]/);
  assert.match(roomTypeReplyRule(), /Private studio/);
  assert.match(roomTypeReplyRule(), /En-suite room/);
  assert.match(roomTypeReplyRule(), /Shared apartment room/);
});

test("English tool results keep the canonical room type and add an English label", async () => {
  const runtime = createRentalTools(initialRentalState("manchester"), () => {}, listings, {locale: "en"});
  const pending = await runtime.tools.searchListings.execute!({}, {toolCallId: "manchester", messages: [], context: {}});
  if (!pending || typeof pending !== "object" || Symbol.asyncIterator in pending) throw new Error("searchListings must return one result");
  const shared = pending.listings.find(item => item.roomType === "合租单间");
  assert.ok(shared);
  assert.equal(shared.roomTypeLabel, "Shared apartment room");
  assert.doesNotMatch(shared.roomTypeLabel, /[\u4e00-\u9fff]/);
});

test("a viewing request is stored for this visitor and is not an outbound agent message", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(schema);
  const db: RentalDatabase = {
    kind: "SQLite",
    async first() { return null; },
    async all() { return []; },
    async run(sql, values = []) { return {changes: Number(sqlite.prepare(sql).run(...(values as (string | number | null)[])).changes)}; },
    close() { sqlite.close(); },
  };
  const saved = await insertViewingRequest(db, {
    owner: "visitor", listingId: "manchester-7", cityId: "manchester", name: "Ada", contact: "ada@example.com", preferredTime: "Saturday morning", message: "demo only",
  });
  const row = sqlite.prepare("SELECT listing_id, name, contact FROM viewing_requests WHERE id = ?").get(saved.id) as {listing_id: string; name: string; contact: string};
  assert.equal(row.listing_id, "manchester-7");
  assert.equal(row.contact, "ada@example.com");
  assert.equal(saved.demo, true);
  db.close();
});
