import { buildingCatchment } from "../lib/student/catchments";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listings, cities } from "../lib/rental-data";
import {
  campusBuildings,
  buildingCommute,
  buildingRouteUrl,
  searchBuildings,
} from "../lib/student/catalog";
import { emptyStudentPlan, calendarDate } from "../lib/student/state";
import {
  monthlyCost,
  weeklyCommute,
  validateStudentPlan,
  matchesHousing,
  housingDetails,
  comparisonSearch,
} from "../lib/student/planner";
import { parseWalkingRoute, metersBetween } from "../lib/walking-route";
import { normalizeTransit } from "../lib/student/transit";

test("costs normalize week rent, retain unknowns and separate refundable deposit", () => {
  const p = emptyStudentPlan(),
    l = listings[0],
    cost = monthlyCost(l, p);
  assert.equal(cost.items.rent, 1386.67);
  assert.equal(cost.items.utilities, 0);
  assert.equal(cost.monthlyTotal, null);
  assert.ok(cost.unknown.includes("transport"));
  p.expenses = {
    utilities: 70,
    internet: 20,
    transport: 50,
    other: 0,
    deposit: 1000,
    oneOff: 100,
  };
  const known = monthlyCost(l, p);
  assert.equal(known.monthlyTotal, 1436.67);
  assert.equal(known.initialOutlay, 2536.67);
  const separate = monthlyCost(listings[2], emptyStudentPlan());
  assert.ok(separate.unknown.includes("utilities"));
  assert.equal(
    monthlyCost(listings.find((l) => l.cityId === "singapore")!, p).items.rent,
    1450,
  );
});
test("date filters reject invalid dates, unavailable/unknown stock and lease boundaries", () => {
  assert.equal(calendarDate.safeParse("2027-02-29").success, false);
  assert.equal(calendarDate.safeParse("2028-02-29").success, true);
  const p = emptyStudentPlan();
  p.housing = { moveIn: "2027-01-01", leaseMonths: 6, availableOnly: true };
  assert.equal(matchesHousing(listings[0], p), false);
  p.housing.moveIn = housingDetails(listings[0]).availableFrom;
  assert.equal(matchesHousing(listings[0], p), true);
  p.housing.leaseMonths = 5;
  assert.equal(matchesHousing(listings[0], p), false);
  assert.equal(matchesHousing(listings[4], p), false);
  assert.equal(matchesHousing(listings[5], p), false);
});
test("planner validates city ownership, duplicates, required destination and bounded weights", () => {
  const london = campusBuildings.find((b) => b.cityId === "london")!,
    other = campusBuildings.find((b) => b.cityId === "sydney")!;
  assert.ok(london && other);
  const p = emptyStudentPlan();
  p.destinationId = other.id;
  assert.throws(() => validateStudentPlan(p, "london"));
  p.destinationId = london.id;
  p.compareIds = ["london-1", "london-1"];
  assert.throws(() => validateStudentPlan(p, "london"));
  p.compareIds = ["london-1", "sydney-1"];
  assert.throws(() => validateStudentPlan(p, "london"));
  p.compareIds = [];
  p.destinations = [{ buildingId: london.id, visitsPerWeek: 15 }];
  assert.throws(() => validateStudentPlan(p, "london"));
  p.destinations = [];
  p.destinationId = null;
  p.catchmentMinutes = 20;
  assert.throws(() => validateStudentPlan(p, "london"));
  assert.deepEqual(
    validateStudentPlan(undefined, "london"),
    emptyStudentPlan(),
  );
});
test("all catalog destinations have city-scoped network snapshots and closed reverse catchments", () => {
  assert.equal(
    new Set(campusBuildings.map((b) => b.id)).size,
    campusBuildings.length,
  );
  assert.ok(campusBuildings.filter((b) => b.cityId === "london").length >= 10);
  for (const city of cities) {
    const buildings = campusBuildings.filter((b) => b.cityId === city.id);
    assert.ok(buildings.length >= 3, city.id);
    for (const b of buildings) {
      assert.ok(Number.isFinite(b.lng) && Number.isFinite(b.lat));
      assert.match(b.source.url, /^https:\/\/www.openstreetmap.org\//);
      const l = listings.find((l) => l.cityId === city.id)!,
        summary = buildingCommute(l.id, b.id);
      assert.ok(summary, `${l.id}:${b.id}`);
      const full = JSON.parse(
        readFileSync(`public${buildingRouteUrl(l.id, b.id)}`, "utf8"),
      );
      const route = parseWalkingRoute(full, l, {
        ...city,
        lng: b.lng,
        lat: b.lat,
      });
      assert.equal(route.distanceMeters, summary.distanceMeters);
      assert.ok(metersBetween(route.destination, [b.lng, b.lat]) < 1);
      const c = buildingCatchment(b.id, 20);
      assert.ok(c, `${b.id}:20`);
      assert.equal(c.source.reverse, true);
      const polygon =
        c.geometry.type === "Polygon"
          ? c.geometry.coordinates
          : c.geometry.coordinates[0];
      const ring = polygon[0] as number[][];
      assert.ok(ring.length >= 4);
      assert.deepEqual(ring[0], ring.at(-1));
    }
  }
});
test("weekly commute uses visit counts and round trips; share preserves selected destination", () => {
  const b = campusBuildings.find((b) => b.cityId === "london")!,
    p = emptyStudentPlan();
  p.destinations = [{ buildingId: b.id, visitsPerWeek: 3 }];
  const r = buildingCommute("london-1", b.id)!;
  assert.equal(
    weeklyCommute("london-1", p).weeklyMinutes,
    Math.ceil((r.durationSeconds * 6) / 60),
  );
  p.destinationId = b.id;
  p.compareIds = ["london-1", "london-2"];
  const q = new URLSearchParams(comparisonSearch("london", p));
  assert.equal(q.get("building"), b.id);
  assert.equal(q.get("compare"), "london-1,london-2");
  assert.ok(
    searchBuildings("london", b.name.toUpperCase()).some((x) => x.id === b.id),
  );
});
test("transit normalization keeps actual legs and rejects invalid geometry/duration", () => {
  const payload = {
    journeys: [
      {
        duration: 12,
        startDateTime: "2026-10-13T09:00:00",
        arrivalDateTime: "2026-10-13T09:12:00",
        legs: [
          {
            duration: 8,
            mode: { name: "bus" },
            instruction: { summary: "Bus 205" },
            path: { lineString: "[[51.52,-0.13],[51.53,-0.14]]" },
          },
        ],
      },
    ],
  };
  const journey = normalizeTransit(payload)[0];
  assert.equal(journey.durationMinutes, 12);
  assert.deepEqual(journey.legs[0].coordinates[0], [-0.13, 51.52]);
  assert.throws(() =>
    normalizeTransit({ journeys: [{ ...payload.journeys[0], duration: -1 }] }),
  );
});
