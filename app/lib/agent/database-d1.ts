import type { RentalDatabase } from "./database";

// Share store logic between SQLite and D1; only prepared statement I/O differs.
export function d1Database(binding: D1Database): RentalDatabase {
  return {
    kind: "D1",
    first<T>(sql: string, values = []) {return binding.prepare(sql).bind(...values).first<T>();},
    async all<T>(sql: string, values = []) {return (await binding.prepare(sql).bind(...values).all<T>()).results;},
    async run(sql, values = []) {
      const result = await binding.prepare(sql).bind(...values).run();
      return {changes: result.meta.changes};
    },
    close() {},
  };
}
