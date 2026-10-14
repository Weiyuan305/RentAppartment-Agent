import { env } from "cloudflare:workers";
import { d1Database } from "./database-d1";

export async function getDatabase() {
  const binding = (env as unknown as {ATLAS_DB?: D1Database}).ATLAS_DB;
  if (!binding) throw new Error("Cloudflare D1 binding ATLAS_DB is missing.");
  return d1Database(binding);
}
