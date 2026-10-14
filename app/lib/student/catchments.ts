import data from "./data/catchments.json";
import type { Catchment } from "./catalog";
const index = data as unknown as Record<string, Catchment>;
export function buildingCatchment(
  buildingId: string | null,
  minutes: number | null,
) {
  return buildingId && minutes ? index[`${buildingId}:${minutes}`] : undefined;
}
