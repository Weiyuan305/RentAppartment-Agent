import type {RentalDatabase} from "./agent/database";

type HealthDependencies = {
  database: () => Promise<RentalDatabase>;
  aiConfigured: () => boolean;
};

// Read schema metadata only: no sessions, quota writes or paid provider calls.
export async function healthResponse({database, aiConfigured}: HealthDependencies) {
  const checks = {database: "error", aiConfiguration: aiConfigured() ? "ok" : "error"};
  try {
    const row = await (await database()).first<{tables: number}>(
      "SELECT COUNT(*) AS tables FROM sqlite_master WHERE type='table' AND name IN ('sessions','quotas','routes')",
    );
    if (row?.tables === 3) checks.database = "ok";
  } catch {
    // Keep database internals and connection errors out of this public endpoint.
  }
  const healthy = Object.values(checks).every(value => value === "ok");
  return Response.json({status: healthy ? "ok" : "error", checks}, {
    status: healthy ? 200 : 503,
    headers: {"Cache-Control": "no-store"},
  });
}
