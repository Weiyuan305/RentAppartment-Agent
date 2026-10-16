import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../lib/agent/database-sqlite";
import { createMerchantService } from "../lib/merchant/service";
import { newProperty, publicationIssues } from "../lib/merchant/model";
import { createRentalTools } from "../lib/agent/tools";
import { emptyStudentPlan } from "../lib/student/state";
import { initialRentalState } from "../lib/agent/contract";
import { compareListings } from "../lib/student/planner";
import { readFavorites } from "../lib/personal-library/model";
import { sameOrigin } from "../lib/agent/http";

test("merchant isolation, moderation snapshots, enquiries, AI and takedown", async () => {
  const dir = mkdtempSync(join(tmpdir(), "atlas-merchant-test-"));
  process.env.ATLAS_CHAT_DB = join(dir, "test.sqlite");
  const db = await getDatabase(),
    s = createMerchantService(db);
  const a = { id: "host-a", admin: false },
    b = { id: "host-b", admin: false },
    student = { id: "student", admin: false },
    admin = { id: "admin", admin: true };
  try {
    for (const u of [a, b, student, admin])
      await db.run(
        "INSERT INTO auth_user (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,0,0,0)",
        [u.id, u.id, `${u.id}@example.test`],
      );
    const profile = {
      name: "Local QA host",
      kind: "landlord",
      contact: "private-host@example.test",
      cities: ["london"],
      evidence: "PRIVATE REVIEW MATERIAL NOT PUBLIC",
    };
    await s.command(a, { kind: "apply", profile, version: 0 });
    const m = (await s.mine(a))!;
    await assert.rejects(
      s.command(a, {
        kind: "reviewMerchant",
        id: m.id,
        version: m.version,
        approve: true,
        reason: "reviewed",
      }),
      /Administrator/,
    );
    await assert.rejects(s.dashboard(a, "admin"), /Administrator/);
    await assert.rejects(
      s.command(a, { kind: "save", version: 0, draft: newProperty() }),
      /approval/,
    );
    await s.command(admin, {
      kind: "reviewMerchant",
      id: m.id,
      version: m.version,
      approve: true,
      reason: "reviewed",
    });
    assert.equal((await s.mine(a))!.defaultCityId, "london");
    await assert.rejects(s.command(student, {kind:"setCity",cityId:"sydney"}), /approval/);
    await s.command(a, {kind:"setCity",cityId:"manchester"});
    assert.equal((await createMerchantService(db).mine(a))!.defaultCityId, "manchester");
    assert.equal((await s.mine(a))!.version, m.version + 1);
    await assert.rejects(s.command(a, {kind:"setCity",cityId:"unknown"}));
    await s.command(b, {kind:"apply",profile:{...profile,cities:["sydney"]},version:0});
    assert.equal((await s.mine(b))!.defaultCityId,"sydney");
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
      name: "QA Atlas House",
      address: "20 Test Street, London",
      area: "Bloomsbury",
      lng: -0.13,
      lat: 51.52,
      entranceConfirmed: true,
      description: "A test home near the campus. All details are fixtures.",
      guarantor: "No guarantor required",
      paymentTerms: "Monthly payment",
      cancellation: "Confirm before signing",
      photos: [photo],
    };
    draft.rooms[0] = {
      ...draft.rooms[0],
      name: "Studio",
      billDetails: "All bills included",
      availableFrom: "2027-01-01",
      availableUntil: "2028-12-31",
      price: 1300,
      period: "month",
    };
    assert.deepEqual(publicationIssues(draft), []);
    const { id } = await s.command(a, { kind: "save", version: 0, draft });
    assert.ok(id);
    await s.command(a,{kind:"setCity",cityId:"melbourne"});
    assert.equal((await s.dashboard(a,"merchant")).properties[0].draft.cityId,"london");

    assert.ok(!(await s.catalogue()).some((l) => l.merchant));
    await assert.rejects(
      s.command(b, { kind: "withdraw", id, version: 0 }),
      /not found/,
    );
    await s.command(a, { kind: "submit", id, version: 0 });
    await assert.rejects(
      s.command(admin, {
        kind: "reviewProperty",
        id,
        version: 0,
        approve: true,
        reason: "reviewed",
      }),
      /refresh/,
    );
    await s.command(admin, {
      kind: "reviewProperty",
      id,
      version: 1,
      approve: true,
      reason: "reviewed",
    });
    let catalog = await s.catalogue();
    const home = catalog.find((l) => l.merchant)!;
    assert.ok(home);
    assert.equal(home.price, 300);
    assert.equal(home.merchant?.price, 1300);
    assert.ok(!JSON.stringify(catalog).includes("PRIVATE REVIEW"));
    assert.ok(!JSON.stringify(catalog).includes(profile.contact));
    assert.deepEqual(readFavorites(JSON.stringify([home.id])), [home.id]);
    assert.equal(
      compareListings([home.id], emptyStudentPlan(), catalog)[0].housing.kind,
      "merchant",
    );
    const state = { ...initialRentalState("london"), listingId: home.id },
      runtime = createRentalTools(state, undefined, catalog),
      opts = { toolCallId: "test", messages: [], context: {} };
    const details = (await runtime.tools.getListingDetails.execute!(
      {},
      opts,
    )) as { source: string };
    assert.equal(details.source, "merchant");
    const found = (await runtime.tools.searchListings.execute!({}, opts)) as {
      listings: { id: string }[];
    };
    assert.ok(found.listings.some((l) => l.id === home.id));
    const nearby = (await runtime.tools.findNearbyAmenities.execute!(
      { category: "convenience", radiusMeters: 500 },
      opts,
    )) as { center: { id: string } };
    assert.equal(nearby.center.id, home.id);
    await runtime.tools.compareApartments.execute!({listingIds:[home.id,"london-1"]},opts);
    await runtime.tools.setWeeklyDestinations.execute!({destinations:[]},opts);
    assert.ok(runtime.getState().student!.compareIds.includes(home.id));
    await s.command(a, {
      kind: "save",
      id,
      version: 2,
      draft: { ...draft, name: "Pending new name" },
    });
    assert.equal(
      (await s.catalogue()).find((l) => l.id === home.id)?.name,
      home.name,
    );
    await s.command(a, { kind: "submit", id, version: 3 });
    await s.command(admin, {
      kind: "reviewProperty",
      id,
      version: 4,
      approve: false,
      reason: "Please correct address",
    });
    assert.equal(
      (await s.catalogue()).find((l) => l.id === home.id)?.name,
      home.name,
    );
    await assert.rejects(
      s.command(a, { kind: "save", id, version: 3, draft }),
      /refresh/,
    );
    const enquiry = await s.command(student, {
      kind: "inquire",
      listing: home.id,
      type: "viewing",
      message: "Please arrange a video tour",
      appointment: new Date(Date.now() + 86400000).toISOString(),
      timezone: "Asia/Shanghai",
      mode: "online",
    });
    const inbox = await s.dashboard(a, "merchant");
    assert.equal(inbox.conversations!.length, 1);
    assert.equal((await s.dashboard(b, "merchant")).conversations!.length, 0);
    await assert.rejects(
      s.command(b, {
        kind: "reply",
        id: enquiry.id,
        version: 0,
        message: "Hello",
        status: "accepted",
      }),
      /not found/,
    );
    await assert.rejects(
      s.command(student, {
        kind: "reply",
        id: enquiry.id,
        version: 0,
        message: "Hello",
        status: "accepted",
      }),
      /Only the merchant/,
    );
    await s.command(a, {
      kind: "reply",
      id: enquiry.id,
      version: 0,
      message: "We can show you tomorrow",
      status: "accepted",
    });
    assert.equal(
      (await s.dashboard(student, "student")).conversations![0].status,
      "accepted",
    );
    await s.command(student, {
      kind: "reply",
      id: enquiry.id,
      version: 1,
      message: "Thank you, see you then",
      status: "accepted",
    });
    assert.equal(
      (await s.dashboard(a, "merchant")).conversations![0].messages.length,
      3,
    );
    await s.command(student, {
      kind: "report",
      listing: home.id,
      reason: "Please check the address",
    });
    assert.equal((await s.dashboard(admin, "admin")).reports!.length, 1);
    await s.command(admin, {
      kind: "takedown",
      id,
      version: 5,
      reason: "Removed for investigation",
    });
    catalog = await s.catalogue();
    assert.ok(!catalog.some((l) => l.id === home.id));
    await assert.rejects(
      s.command(student, {
        kind: "inquire",
        listing: home.id,
        type: "enquiry",
        message: "Is it available?",
        appointment: "",
        timezone: "UTC",
        mode: "online",
      }),
      /unavailable/,
    );
    assert.ok((await s.dashboard(admin, "admin")).audit!.length >= 5);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("publication validates dates and entrance, and mutations reject cross-origin", () => {
  const p = newProperty();
  p.rooms[0].availableFrom = "2027-99-99";
  assert.ok(publicationIssues(p).length);
  assert.throws(() =>
    sameOrigin(
      new Request("https://atlas.example/api/merchant", {
        headers: { origin: "https://evil.example" },
      }),
    ),
  );
});
