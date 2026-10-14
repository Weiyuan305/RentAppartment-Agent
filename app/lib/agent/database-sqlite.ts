import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { schema, type RentalDatabase } from "./database";
import { authSchemaSQL } from "../auth-schema";
import { librarySchemaSQL } from "../personal-library/schema";

const runtime = globalThis as typeof globalThis & {atlasRentalDB?: RentalDatabase};
export async function getDatabase(): Promise<RentalDatabase> {
  if (runtime.atlasRentalDB) return runtime.atlasRentalDB;
  const path = resolve(process.env.ATLAS_CHAT_DB || ".data/rental-chat.sqlite");
  mkdirSync(dirname(path), {recursive: true, mode: 0o700});
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; ${schema} ${authSchemaSQL} ${librarySchemaSQL}`);
  runtime.atlasRentalDB = {
    kind: "SQLite",
    async first<T>(sql: string, values = []) {return db.prepare(sql).get(...values) as T | undefined ?? null;},
    async all<T>(sql: string, values = []) {return db.prepare(sql).all(...values) as T[];},
    async run(sql, values = []) {return {changes: Number(db.prepare(sql).run(...values).changes)};},
    close() {db.close(); delete runtime.atlasRentalDB;},
  };
  return runtime.atlasRentalDB;
}
