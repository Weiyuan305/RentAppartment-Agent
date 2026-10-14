import { consumeQuota, database } from "../agent/store";
import type { Listing } from "../rental-data";
import type { CampusBuilding } from "./catalog";
import { normalizeTransit, type TransitJourney } from "./transit";
const pending = new Map<string, Promise<TransitJourney[]>>();
export async function getTransitJourneys(
  listing: Listing,
  building: CampusBuilding,
): Promise<TransitJourney[]> {
  if (listing.cityId !== "london" || building.cityId !== listing.cityId)
    throw new Error("此城市请使用官方出行规划入口。");
  const key = `transit:${listing.id}:${building.id}`,
    now = Date.now();
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    const db = await database(),
      saved = await db.first<{ payload: string }>(
        "SELECT payload FROM routes WHERE key=? AND expires>?",
        [key, now],
      );
    if (saved) return JSON.parse(saved.payload) as TransitJourney[];
    await consumeQuota("transit-upstream", 2, 1000);
    await consumeQuota("transit-global", 100, 86400000);
    const url = new URL(
      `https://api.tfl.gov.uk/Journey/JourneyResults/${listing.lat},${listing.lng}/to/${building.lat},${building.lng}`,
    );
    url.searchParams.set("mode", "tube,bus,walking");
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "CampusAtlas-StudentPlanner/1.0" },
    });
    if (!response.ok) throw new Error(`TfL upstream returned HTTP ${response.status}`);
    const journeys = normalizeTransit(await response.json());
    await db.run(
      "INSERT OR REPLACE INTO routes (key,payload,expires) VALUES (?,?,?)",
      [key, JSON.stringify(journeys), now + 5 * 60000],
    );
    return journeys;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}
