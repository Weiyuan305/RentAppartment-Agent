export type SqlValue = string | number | null;
export interface RentalDatabase {
  readonly kind: "SQLite" | "D1";
  first<T>(sql: string, values?: SqlValue[]): Promise<T | null>;
  all<T>(sql: string, values?: SqlValue[]): Promise<T[]>;
  run(sql: string, values?: SqlValue[]): Promise<{changes: number}>;
  close(): void;
}

export const schema = `
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, city TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, messages TEXT NOT NULL, lease INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, UNIQUE(owner, city));
CREATE TABLE IF NOT EXISTS quotas (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS routes (key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS routes_expiry ON routes(expires);
`;
