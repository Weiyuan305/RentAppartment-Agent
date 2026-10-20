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
