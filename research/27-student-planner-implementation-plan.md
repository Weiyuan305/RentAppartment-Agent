# Student Rental Planner Implementation Plan

> Execution: main agent owns implementation, integration and acceptance under user AGENTS.md. Use executing-plans principles inline; requesting-code-review dispatches one independent, read-only review after the feature is testable. User has authorized implementation and GitHub synchronization; no repeated design approval.

**Goal:** Deliver building-specific navigation/filtering, apartment comparison and sharing, true walking catchments, complete expense calculation, weighted multiple destinations, sourced public-transport planning, and date/lease/availability filters without changing the selected B visual direction or existing rental/chat/auth functions.

**Architecture:** A validated, sourced campus catalog and saved real pedestrian route/catchment snapshots feed a pure planner domain layer. Versioned optional planner state extends existing persisted chat state; UI and agent tools call the same calculations. Public transport uses verified provider journeys where available and explicitly labelled operator planning handoffs elsewhere, with no fabricated timetable. Existing demo listings get explicit demo housing metadata and editable expense assumptions.

**Tech Stack:** Existing React 19 / TypeScript / Cesium / Zod / AI SDK / SQLite-D1 / Cloudflare stack; Node scripts for bounded snapshot collection. No new paid service or framework.

## Constraints and completion criteria

- Preserve Chinese/English UI, visitor-language replies, B appearance, native crisp markers, existing amenities, routes, auth, favorites, mobile tabs and session isolation.
- All coordinates and geometry come from bounded OSM queries, existing catalogs or route providers. Record source, collection date and entrance certainty. Do not present building centres as verified doors.
- Selected building changes route, walking filter and comparison destination together. Invalid/cross-city IDs and stale route responses must be rejected or ignored.
- Unknown housing/expense/transit data remains unknown, never silently zero/available/live. No invented safety score or safe-route claim.
- Implement all feature categories; demonstrate full sourced London flow and validate catalogs/calculations for all five existing cities. Disclose specific data coverage limits.
- Add substantive domain/state/API regressions; run existing relevant agent/store/auth checks, typecheck and Cloudflare build; exercise browser desktop/mobile and Chinese/English flows.
- Fix important review findings before Git upload. Stage authored project files only, inspect secret/artifact exclusions, refresh remote, push and report branch plus full SHA. Deployment follows Git synchronization only if continuing the existing authorized Cloudflare release workflow.

## Task 1: Campus catalog and real network snapshots

Files: `app/lib/student/catalog.ts`, `app/lib/student/data/*.json`, `app/scripts/collect-campus-planner.ts`, `research/evidence/campus-planner/*`.
Interface: `CampusBuilding {id,cityId,campusId,name,aliases,lng,lat,category,locationType,source}`; catalog lookup accepts only known IDs. Route snapshot key is `${listingId}:${buildingId}`. Catchment is a reverse pedestrian GeoJSON polygon for 10/20/30 minutes, tied to one building ID and source.

- [x] Collect bounded named-campus building records and preserve OSM IDs/source evidence; curate university-related buildings.
- [x] Collect six-listing pedestrian route matrix per campus building, reuse existing cache, pace requests; save route failure explicitly rather than substitute straight lines.
- [x] Collect destination-specific reverse pedestrian catchments with official Valhalla options; validate polygons and coordinate bounds.
- [x] Test catalog uniqueness, city ownership, route endpoints, offsets and source; exclude unavailable results from strict walking filters.

## Task 2: Planner calculations and validated state

Files: `app/lib/student/planner.ts`, `app/lib/student/state.ts`, `app/lib/assistant.ts`, `app/lib/agent/contract.ts`, `app/lib/agent/catalog.ts`, `app/tests/student-planner.test.ts`.
Interfaces: `monthlyCost(listing, assumptions)`, `matchesHousing(listing, preferences)`, `buildingCommute(listingId,buildingId)`, `compareListings(ids,plan)`, `weeklyCommute(listingId,destinations)`, `validateStudentPlan(plan,cityId)`. Planner state includes destination/building layer/catchment, max three comparison IDs, max five weekly destinations, expense assumptions and housing preferences.

- [x] Write regression tests for weekly-to-monthly 52/12 conversion, included utilities, unknown totals, fees separate from monthly costs, date-window inclusion and lease boundaries.
- [x] Test duplicate/cross-city/unknown IDs, invalid dates and ranges, old session compatibility and comparison sharing limits.
- [x] Implement pure functions and one shared planner schema; existing campus-time filtering remains the default when no building is selected.

## Task 3: Agent tools and public endpoints

Files: `app/lib/student/tools.ts`, `app/lib/agent/tools.ts`, `app/app/api/agent/chat/route.ts`, `app/app/api/student/route.ts`, `app/tests/student-agent.test.ts`.
Interface: bounded catalog search, select destination, building route, compare, catchment, cost, weekly destinations, housing filters and transit tools all validate the city before updating the existing serialized tool state.

- [x] Test building-name ambiguity returns candidates, selection persists across amenity follow-ups, building route matches UI state, limits and old session restoration.
- [x] Serve only validated known catalog/snapshot IDs; no arbitrary upstream URL or coordinate proxy.
- [x] Update agent instructions and output facts without changing latest-message language behavior or existing call/timeout protections.

## Task 4: B workspace, comparison, map and transit UI

Files: `app/components/student/*`, `app/components/design-lab/design-lab.tsx`, `app/components/design-lab/concept-city-map.tsx`, `app/components/design-lab/map-place-labels.tsx`, `app/app/design-lab/design-lab.css`, `app/components/listing-detail.tsx`.

- [x] Add a compact planner entry beside university and an accessible dialog with destination, housing, expenses and weekly places; all tabs bilingual.
- [x] Add max-three comparison selection to cards and a scrollable comparison view with shareable validated URL state, totals and known/unknown commute/perks.
- [x] Overlay buildings/catchments in existing Cesium viewer, retain native SVG/text labels and entity picking, clean up entities and listeners, show source and entrance certainty.
- [x] Route to selected building from property actions, keep existing facility routing, clear stale geometry on destination/city changes.
- [x] Add sourced public-transport options: official links for every city and server-calculated journeys where provider data is available; label external handoff distinctly from computed journeys.
- [x] Exercise destination → route → filter → compare → save/share/restore; cost edits, multi-stop weights, dates; existing photo/details/favorite/chat flows on desktop/mobile and both languages.

## Task 5: Review, verification and Git delivery

- [x] Run new domain and tool regressions plus existing agent/store/auth tests, typecheck, targeted lint, Cloudflare build and build secret guards.
- [x] Dispatch an independent read-only code review with baseline, plan, actual changed files and evidence; fix Critical/Important findings and rerun affected checks.
- [x] Record completed scope, evidence and data limits in `research/28-student-planner-release.md` and update app README.
- [x] Inspect ignore rules and staged paths, commit authored work, fetch remote, integrate safely and push user's GitHub repo. Verify remote SHA and report exact branch/commit.

Acceptance detail and limitations, including emulated mobile pointer testing, are recorded in `28-student-planner-release.md`. Code has been synchronized to GitHub main before deployment. The TfL anonymous Cloudflare rate-limit and fallback are explicitly recorded; keyed live transit is a separate target-environment acceptance gap.
