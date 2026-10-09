import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { initialRentalState, type RentalSession, type RentalState, type RentalMessage } from "./contract";

export class SessionError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
type Row = {id: string; version: number; state: string; messages: string; lease: number};
const runtime = globalThis as typeof globalThis & {atlasDB?: DatabaseSync};
export function database() {
  if (runtime.atlasDB) return runtime.atlasDB;
  const path = resolve(process.env.ATLAS_CHAT_DB || ".data/rental-chat.sqlite");
  mkdirSync(dirname(path), {recursive: true, mode: 0o700});
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, city TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, messages TEXT NOT NULL, lease INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, UNIQUE(owner, city));
    CREATE TABLE IF NOT EXISTS quotas (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS routes (key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires INTEGER NOT NULL);`);
  runtime.atlasDB = db;
  return db;
}
export const ownerHash = (token: string) => createHash("sha256").update(token).digest("hex");
function decode(row: Row): RentalSession {return {id: row.id, version: row.version, state: JSON.parse(row.state), messages: JSON.parse(row.messages)};}
export function loadSession(owner: string, id: string) {
  const row = database().prepare("SELECT * FROM sessions WHERE owner=? AND id=?").get(owner, id) as Row | undefined;
  if (!row) throw new SessionError("会话不存在，请刷新页面。", 404);
  return decode(row);
}
export function sessionForCity(owner: string, city: RentalState["cityId"]) {
  const db = database();
  db.prepare("INSERT OR IGNORE INTO sessions (id,owner,city,state,messages,updated) VALUES (?,?,?,?,?,?)").run(randomUUID(), owner, city, JSON.stringify(initialRentalState(city)), "[]", Date.now());
  const row = db.prepare("SELECT * FROM sessions WHERE owner=? AND city=?").get(owner, city) as Row;
  return decode(row);
}
export function acquireSession(owner: string, id: string, version: number, state: RentalState) {
  const session = loadSession(owner, id);
  if (session.state.cityId !== state.cityId) throw new SessionError("会话城市不匹配。", 400);
  const result = database().prepare("UPDATE sessions SET version=version+1,state=?,lease=?,updated=? WHERE owner=? AND id=? AND version=? AND lease<?")
    .run(JSON.stringify(state), Date.now() + 120000, Date.now(), owner, id, version, Date.now());
  if (!result.changes) throw new SessionError("会话正在处理或已在其他页面更新，请刷新后重试。");
  return {...session, version: version + 1, state};
}
export function finishSession(owner: string, session: RentalSession, messages: RentalMessage[], state: RentalState) {
  // A stopped stream may have unfinished tool arguments. Keep completed results
  // but never send an orphaned tool call back to a provider on the next turn.
  const completed = messages.map(message => ({...message, parts: message.parts.filter(part => !part.type.startsWith("tool-") || !("state" in part) || typeof part.state !== "string" || !["input-streaming", "input-available"].includes(part.state))}))
    .filter(message => message.role !== "assistant" || message.metadata?.replyStatus || message.parts.some(part => part.type === "text" || part.type === "reasoning" || part.type.startsWith("tool-")));
  // The version prevents a timed-out request from overwriting a newer turn.
  database().prepare("UPDATE sessions SET state=?,messages=?,lease=0,updated=? WHERE owner=? AND id=? AND version=?")
    .run(JSON.stringify(state), JSON.stringify(completed.slice(-100)), Date.now(), owner, session.id, session.version);
}
export function saveState(owner: string, id: string, version: number, state: RentalState, clear = false) {
  const session = acquireSession(owner, id, version, state);
  finishSession(owner, session, clear ? [] : session.messages, state);
  return loadSession(owner, id);
}
export function consumeQuota(key: string, maximum: number, milliseconds: number) {
  const db = database(), now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM quotas WHERE expires<?").run(now);
    const row = db.prepare("SELECT count FROM quotas WHERE key=?").get(key) as {count: number} | undefined;
    if ((row?.count ?? 0) >= maximum) throw new SessionError("体验版请求次数已达上限，请稍后再试。", 429);
    db.prepare("INSERT INTO quotas (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1").run(key, now + milliseconds);
    db.exec("COMMIT");
  } catch (error) {db.exec("ROLLBACK"); throw error;}
}
