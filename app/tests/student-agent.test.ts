import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = mkdtempSync(join(tmpdir(), "atlas-student-"));
process.env.ATLAS_CHAT_DB = join(directory, "sessions.sqlite");
const { createRentalTools } = await import("../lib/agent/tools");
const { initialRentalState } = await import("../lib/agent/contract");
const { validateRentalState } = await import("../lib/agent/catalog");
const { campusBuildings, buildingCommute } = await import(
  "../lib/student/catalog"
);
const { matchesFilters } = await import("../lib/assistant");
const { listings } = await import("../lib/rental-data");
const store = await import("../lib/agent/store");
const options = { toolCallId: "test", messages: [], context: {} };
after(async () => {
  (await store.database()).close();
  rmSync(directory, { recursive: true, force: true });
});
test("building selection, network filter and follow-up route use one persisted destination", async () => {
  const runtime = createRentalTools(initialRentalState("london"));
  const found = await runtime.tools.searchCampusBuildings.execute!(
    { query: "Wilkins" },
    options,
  );
  assert.ok(found);
  const b = campusBuildings.find((b) => b.name === "Wilkins Building")!;
  await runtime.tools.selectCampusDestination.execute!(
    { buildingId: b.id },
    options,
  );
  await runtime.tools.searchListings.execute!({ walkMinutes: 15 }, options);
  const state = runtime.getState(),
    expected = listings.filter(
      (l) =>
        l.cityId === "london" &&
        buildingCommute(l.id, b.id)!.durationSeconds <= 900,
    );
  assert.equal(
    listings.filter(
      (l) =>
        l.cityId === "london" &&
        matchesFilters(l, state.filters, state.student),
    ).length,
    expected.length,
  );
  await runtime.tools.planCampusBuildingRoute.execute!(
    { listingId: runtime.getState().listingId },
    options,
  );
  assert.equal(runtime.getState().student?.routeBuilding, true);
  await runtime.tools.findNearbyAmenities.execute!(
    { category: "convenience" },
    options,
  );
  assert.equal(runtime.getState().student?.destinationId, b.id);
  const owner = store.ownerHash("student-test"),
    session = await store.sessionForCity(owner, "london"),
    saved = await store.saveState(
      owner,
      session.id,
      session.version,
      runtime.getState(),
    );
  assert.equal(
    (await store.loadSession(owner, saved.id)).state.student?.destinationId,
    b.id,
  );
});
test("tools reject cross-city destinations and compare ids without altering state", async () => {
  const runtime = createRentalTools(initialRentalState("london")),
    b = campusBuildings.find((b) => b.cityId === "sydney")!;
  await assert.rejects(
    Promise.resolve(
      runtime.tools.selectCampusDestination.execute!(
        { buildingId: b.id },
        options,
      ),
    ),
  );
  await assert.rejects(
    Promise.resolve(
      runtime.tools.compareApartments.execute!(
        { listingIds: ["london-1", "sydney-1"] },
        options,
      ),
    ),
  );
  assert.equal(runtime.getState().student?.destinationId, null);
  const p = runtime.getState();
  p.student!.compareIds = ["london-1", "london-1"];
  assert.throws(() => validateRentalState(p));
});
test("expenses, dates and weekly destinations survive unrelated amenity changes", async () => {
  const runtime = createRentalTools(initialRentalState("london")),
    b = campusBuildings.find((b) => b.cityId === "london")!;
  await runtime.tools.updateStudentPreferences.execute!(
    {
      moveIn: "2027-03-01",
      leaseMonths: 12,
      availableOnly: true,
      transport: 70,
      other: 0,
    },
    options,
  );
  await runtime.tools.setWeeklyDestinations.execute!(
    { destinations: [{ buildingId: b.id, visitsPerWeek: 4 }] },
    options,
  );
  await runtime.tools.findNearbyAmenities.execute!(
    { category: "supermarket" },
    options,
  );
  const p = runtime.getState().student!;
  assert.equal(p.expenses.transport, 70);
  assert.equal(p.expenses.utilities, null);
  assert.equal(p.housing.moveIn, "2027-03-01");
  assert.equal(p.destinations[0].visitsPerWeek, 4);
  await runtime.tools.compareApartments.execute!(
    { listingIds: ["london-1", "london-2"] },
    options,
  );
  assert.equal(runtime.getState().student?.compareIds.length, 2);
});
test("student API rejects arbitrary coords/unknown or cross-city IDs and returns catalog facts", async () => {
  const api = await import("../app/api/student/route"),
    b = campusBuildings.find((b) => b.cityId === "london")!;
  const request = (q: string) =>
    new Request(`http://localhost/api/student?${q}`);
  assert.equal(
    (
      await api.GET(
        request("kind=transit&city=london&listing=sydney-1&building=" + b.id),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await api.GET(
        request(
          "kind=transit&city=london&listing=london-1&building=evil&url=https://example.com",
        ),
      )
    ).status,
    400,
  );
  const response = await api.GET(
    request(`kind=commute&city=london&listing=london-1&building=${b.id}`),
  );
  assert.equal(response.status, 200);
  const payload = (await response.json()) as { route: { buildingId: string } };
  assert.equal(payload.route.buildingId, b.id);
});
test("housing reconciliation returns the newly selected apartment cost, not the previous one", async () => {
  const runtime = createRentalTools(initialRentalState("london"));
  const result = (await runtime.tools.updateStudentPreferences.execute!(
    { moveIn: "2027-01-01" },
    options,
  )) as { currentApartment: { id: string }; cost: { items: { rent: number } } };
  assert.equal(runtime.getState().listingId, "london-3");
  assert.equal(result.currentApartment.id, "london-3");
  assert.equal(result.cost.items.rent, 1278.33);
});
test("legacy route actions honor the selected building and keep route modes exclusive", async () => {
  const runtime = createRentalTools(initialRentalState("london")),
    b = campusBuildings.find((b) => b.name === "Wilkins Building")!;
  await runtime.tools.selectCampusDestination.execute!(
    { buildingId: b.id },
    options,
  );
  await runtime.tools.planCampusBuildingRoute.execute!(
    { listingId: runtime.getState().listingId },
    options,
  );
  const result = (await runtime.tools.planWalkingRoute.execute!(
    { destination: "campus" },
    options,
  )) as { destination: string; distanceMeters: number };
  assert.equal(result.destination, b.name);
  assert.equal(
    result.distanceMeters,
    buildingCommute("london-1", b.id)!.distanceMeters,
  );
  assert.equal(runtime.getState().map.campusRoute, false);
  assert.equal(runtime.getState().student?.routeBuilding, true);
  await runtime.tools.findNearbyAmenities.execute!(
    { category: "convenience" },
    options,
  );
  assert.equal(runtime.getState().student?.routeBuilding, false);
  assert.equal(runtime.getState().student?.transitRequested, false);
});

test("explicit detail context wins over stale saved destination and preserves private preferences", async () => {
  const { stateForNavigation } = await import("../lib/student/restore");
  const saved = createRentalTools(initialRentalState("london")).getState(),
    page = initialRentalState("london");
  const b = campusBuildings.find((b) => b.name === "Wilkins Building")!;
  saved.student!.expenses.transport = 45;
  saved.student!.housing.leaseMonths = 6;
  saved.student!.destinations = [{ buildingId: b.id, visitsPerWeek: 3 }];
  const same = stateForNavigation(
    saved,
    page,
    new URLSearchParams({
      listing: "london-1",
      building: b.id,
      route: "walk",
      compare: "london-1,london-2",
    }),
  );
  assert.equal(same.student?.destinationId, b.id);
  assert.equal(same.student?.routeBuilding, true);
  assert.equal(same.map.campusRoute, false);
  assert.equal(same.student?.expenses.transport, 45);
  assert.equal(same.student?.housing.leaseMonths, 6);
  assert.equal(same.student?.destinations.length, 1);
  const other = stateForNavigation(
    saved,
    page,
    new URLSearchParams({ listing: "london-3", building: b.id, route: "walk" }),
  );
  assert.equal(other.listingId, "london-3");
  assert.equal(other.student?.destinationId, b.id);
  const cleared = stateForNavigation(
    same,
    page,
    new URLSearchParams({
      listing: "london-1",
      building: "university-default",
      compare: "",
      route: "walk",
    }),
  );
  assert.equal(cleared.student?.destinationId, null);
  assert.equal(cleared.student?.routeBuilding, false);
  assert.equal(cleared.map.campusRoute, true);
  assert.deepEqual(cleared.student?.compareIds, []);
  assert.deepEqual(
    stateForNavigation(
      saved,
      page,
      new URLSearchParams({ share: "1", building: b.id }),
    ),
    page,
  );
});

test("a named route origin is validated and becomes the map origin", async () => {
  const runtime = createRentalTools(initialRentalState("london"));
  const b = campusBuildings.find((b) => b.name === "Student Centre")!;
  await runtime.tools.selectCampusDestination.execute!(
    { buildingId: b.id },
    options,
  );
  const result = (await runtime.tools.planCampusBuildingRoute.execute!(
    { listingId: "london-2" },
    options,
  )) as { origin: string; listingId: string; distanceMeters: number };
  assert.equal(result.origin, "Chapter House");
  assert.equal(result.listingId, "london-2");
  assert.equal(
    result.distanceMeters,
    buildingCommute("london-2", b.id)!.distanceMeters,
  );
  assert.equal(runtime.getState().listingId, "london-2");
  await assert.rejects(async () =>
    runtime.tools.planCampusBuildingRoute.execute!(
      { listingId: "sydney-1" },
      options,
    ),
  );
  assert.equal(runtime.getState().listingId, "london-2");
});

test("TfL rate limiting returns an honest external handoff and keeps keys server-only", async () => {
  const originalFetch = globalThis.fetch,
    previousKey = process.env.ATLAS_TFL_API_KEY;
  let requestedKey: string | null = null;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedKey = new URL(String(input)).searchParams.get("app_key");
    return new Response("{}", { status: 429 });
  }) as typeof fetch;
  process.env.ATLAS_TFL_API_KEY = "fixture-tfl-secret";
  try {
    const runtime = createRentalTools(initialRentalState("london")),
      b = campusBuildings.find((b) => b.name === "Student Centre")!;
    await runtime.tools.selectCampusDestination.execute!(
      { buildingId: b.id },
      options,
    );
    const result = (await runtime.tools.planPublicTransport.execute!(
      {},
      options,
    )) as { kind: string; reason: string; directionsUrl: string };
    assert.equal(requestedKey, "fixture-tfl-secret");
    assert.equal(result.kind, "external-planner");
    assert.equal(result.reason, "provider-rate-limit");
    assert.ok(
      result.directionsUrl.startsWith("https://www.google.com/maps/dir/"),
    );
    assert.ok(!JSON.stringify(result).includes("fixture-tfl-secret"));
    assert.equal(runtime.getState().student?.transitRequested, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.ATLAS_TFL_API_KEY;
    else process.env.ATLAS_TFL_API_KEY = previousKey;
  }
});

test("demo transit uses an official handoff without a key or upstream request", async () => {
  const originalFetch = globalThis.fetch,
    previousKey = process.env.ATLAS_TFL_API_KEY;
  delete process.env.ATLAS_TFL_API_KEY;
  globalThis.fetch = (async () => {
    throw new Error("Demo handoff must not call upstream");
  }) as typeof fetch;
  try {
    const runtime = createRentalTools(initialRentalState("london")),
      b = campusBuildings.find((b) => b.name === "Student Centre")!;
    await runtime.tools.selectCampusDestination.execute!(
      { buildingId: b.id },
      options,
    );
    const result = (await runtime.tools.planPublicTransport.execute!(
      {},
      options,
    )) as { kind: string; url: string; directionsUrl: string };
    assert.equal(result.kind, "external-planner");
    assert.equal(result.url, "https://tfl.gov.uk/plan-a-journey/");
    const { GET } = await import("../app/api/student/route");
    const response = await GET(
      new Request(
        "https://atlas.invalid/api/student?kind=transit&city=london&listing=london-1&building=" +
          encodeURIComponent(b.id),
      ),
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).kind, "external-planner");
    assert.equal(runtime.getState().student?.transitRequested, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.ATLAS_TFL_API_KEY;
    else process.env.ATLAS_TFL_API_KEY = previousKey;
  }
});
