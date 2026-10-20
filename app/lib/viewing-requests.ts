import { randomUUID } from "node:crypto";
import type { RentalDatabase } from "./agent/database";

export const viewingRequestsSchema = `
CREATE TABLE IF NOT EXISTS viewing_requests (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  city_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  preferred_time TEXT NOT NULL,
  message TEXT NOT NULL,
  created INTEGER NOT NULL
);
`;

export async function ensureViewingRequests(db: RentalDatabase) {
  await db.run(viewingRequestsSchema);
}

export async function insertViewingRequest(db: RentalDatabase, row: {
  owner: string;
  listingId: string;
  cityId: string;
  name: string;
  contact: string;
  preferredTime: string;
  message: string;
}) {
  await ensureViewingRequests(db);
  const id = randomUUID();
  await db.run(
    "INSERT INTO viewing_requests (id, owner, listing_id, city_id, name, contact, preferred_time, message, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, row.owner, row.listingId, row.cityId, row.name, row.contact, row.preferredTime, row.message, Date.now()],
  );
  return { id, demo: true as const };
}
