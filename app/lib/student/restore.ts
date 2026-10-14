import type { RentalState } from "../agent/contract";
import { listings } from "../rental-data";
import { buildingById } from "./catalog";
import { normalizedStudentPlan } from "./state";
import { validateStudentPlan } from "./planner";

/** A late conversation load must not overwrite newer manual page changes. */
export function canRestoreSessionContext(startRevision: number, currentRevision: number, restoredBrowse: boolean) {
  return !restoredBrowse && startRevision === currentRevision;
}

/** Explicit public navigation context wins; private estimates stay with this session. */
export function stateForNavigation(
  saved: RentalState,
  page: RentalState,
  query: URLSearchParams,
): RentalState {
  if (query.get("share") === "1") return page;
  const requested = listings.find(
    (l) => l.id === query.get("listing") && l.cityId === saved.cityId,
  );
  const different = Boolean(requested && requested.id !== saved.listingId);
  const next: RentalState = {
    ...saved,
    listingId: requested?.id ?? saved.listingId,
    filters: different ? page.filters : saved.filters,
    map: different ? page.map : saved.map,
  };
  let student = { ...normalizedStudentPlan(saved.student) };
  if (query.has("building")) {
    const b = buildingById(query.get("building")),
      selected = b?.cityId === saved.cityId ? b : undefined;
    const changed = student.destinationId !== (selected?.id ?? null);
    student = {
      ...student,
      destinationId: selected?.id ?? null,
      campusId: selected?.campusId ?? null,
      showBuildings: Boolean(selected),
      catchmentMinutes: selected ? student.catchmentMinutes : null,
      routeBuilding: changed ? false : student.routeBuilding,
      transitRequested: changed ? false : student.transitRequested,
    };
    if (changed)
      next.map = {
        ...next.map,
        campusRoute: false,
        routePlaceId: null,
        selectedPlaceId: null,
      };
  }
  if (query.has("compare")) {
    const ids = (query.get("compare") ?? "").split(",").filter(Boolean);
    if (
      ids.length <= 3 &&
      new Set(ids).size === ids.length &&
      ids.every((id) =>
        listings.some((l) => l.id === id && l.cityId === saved.cityId),
      )
    )
      student = { ...student, compareIds: ids };
  }
  if (query.get("route") === "walk") {
    student = {
      ...student,
      routeBuilding: Boolean(student.destinationId),
      transitRequested: false,
    };
    next.map = {
      ...next.map,
      campusRoute: !student.destinationId,
      routePlaceId: null,
      selectedPlaceId: null,
    };
  }
  return { ...next, student: validateStudentPlan(student, saved.cityId) };
}
