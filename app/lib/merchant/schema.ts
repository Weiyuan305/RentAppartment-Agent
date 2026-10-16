export const merchantSchemaSQL = `
CREATE TABLE IF NOT EXISTS merchants (id TEXT PRIMARY KEY, owner TEXT NOT NULL UNIQUE REFERENCES auth_user(id), status TEXT NOT NULL, profile TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS properties (id TEXT PRIMARY KEY, merchant TEXT NOT NULL REFERENCES merchants(id), draft TEXT NOT NULL, published TEXT, status TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, publishedAt INTEGER);
CREATE INDEX IF NOT EXISTS properties_merchant ON properties(merchant);
CREATE TABLE IF NOT EXISTS merchant_media (id TEXT PRIMARY KEY, merchant TEXT NOT NULL REFERENCES merchants(id), mime TEXT NOT NULL, data TEXT NOT NULL, size INTEGER NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS merchant_media_owner ON merchant_media(merchant);
CREATE TABLE IF NOT EXISTS merchant_conversations (id TEXT PRIMARY KEY, student TEXT NOT NULL REFERENCES auth_user(id), merchant TEXT NOT NULL REFERENCES merchants(id), listing TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, appointment TEXT NOT NULL, timezone TEXT NOT NULL, mode TEXT NOT NULL, messages TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS merchant_conversations_student ON merchant_conversations(student);
CREATE INDEX IF NOT EXISTS merchant_conversations_owner ON merchant_conversations(merchant);
CREATE TABLE IF NOT EXISTS merchant_audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS merchant_reports (id TEXT PRIMARY KEY, student TEXT NOT NULL, listing TEXT NOT NULL, reason TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
`;
