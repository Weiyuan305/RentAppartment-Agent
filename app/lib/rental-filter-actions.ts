import { emptyFilters, type Filters } from "./assistant";
import { emptyStudentPlan, type StudentPlan } from "./student/state";
export type FilterSnapshot = { filters: Filters; housing: StudentPlan["housing"]; onlySaved: boolean };
export type FilterKey = keyof Filters | keyof StudentPlan["housing"] | "onlySaved";
export function removeRentalFilter(current: FilterSnapshot, key: FilterKey | "all"): FilterSnapshot {
  if (key === "all") return { filters: {...emptyFilters}, housing: emptyStudentPlan().housing, onlySaved: false };
  if (key === "onlySaved") return {...current, onlySaved: false};
  if (key in emptyFilters) return {...current, filters: {...current.filters, [key]: emptyFilters[key as keyof Filters]}};
  return {...current, housing: {...current.housing, [key]: emptyStudentPlan().housing[key as keyof StudentPlan["housing"]]}};
}
export function sameRentalFilters(a: FilterSnapshot, b: FilterSnapshot) {
  return a.onlySaved === b.onlySaved && (Object.keys(emptyFilters) as (keyof Filters)[]).every(key => a.filters[key] === b.filters[key])
    && a.housing.moveIn === b.housing.moveIn && a.housing.leaseMonths === b.housing.leaseMonths && a.housing.availableOnly === b.housing.availableOnly;
}
