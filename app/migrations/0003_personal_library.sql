-- Account-owned favorites and viewing notes; additive migration.

CREATE TABLE IF NOT EXISTS account_favorites (
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,
  saved INTEGER NOT NULL CHECK(saved IN (0,1)),
  version INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY(user_id, listing_id)
);
CREATE TABLE IF NOT EXISTS account_notes (
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,
  note TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY(user_id, listing_id)
);
