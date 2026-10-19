import { createHash, randomUUID } from "node:crypto";
import { getDatabase } from "@atlas/database";
import type { RentalDatabase } from "./database";
import { initialRentalState, type RentalSession, type RentalState, type RentalMessage } from "./contract";

export class SessionError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
type Row = {id: string; version: number; state: string; messages: string; lease: number};
export const ownerHash = (token: string) => createHash("sha256").update(token).digest("hex");
function decode(row: Row): RentalSession {return {id: row.id, version: row.version, state: JSON.parse(row.state), messages: JSON.parse(row.messages), processingUntil: row.lease};}

export function createStore(database: () => Promise<RentalDatabase>) {
  async function loadSession(owner: string, id: string) {
    const row = await (await database()).first<Row>("SELECT * FROM sessions WHERE owner=? AND id=?", [owner, id]);
    if (!row) throw new SessionError("会话不存在，请刷新页面。", 404);
    return decode(row);
  }
  async function sessionForCity(owner: string, city: RentalState["cityId"]) {
    const db = await database();
    await db.run("INSERT OR IGNORE INTO sessions (id,owner,city,state,messages,updated) VALUES (?,?,?,?,?,?)", [randomUUID(), owner, city, JSON.stringify(initialRentalState(city)), "[]", Date.now()]);
    const row = await db.first<Row>("SELECT * FROM sessions WHERE owner=? AND city=?", [owner, city]);
    if (!row) throw new Error("Unable to create rental session.");
    return decode(row);
  }
  async function acquireSession(owner: string, id: string, version: number, state: RentalState, turn?: {message: RentalMessage; retry?: boolean}) {
    const session = await loadSession(owner, id);
    if (session.state.cityId !== state.cityId) throw new SessionError("会话城市不匹配。", 400);
    let messages = session.messages;
    if (turn) {
      const last = messages.findLastIndex(message => message.role === "user");
      if (turn.retry) {
        if (last < 0 || messages[last].id !== turn.message.id) throw new SessionError("只能重试最近一条消息，请刷新同步。", 400);
        messages = messages.slice(0, last + 1);
      } else {
        if (messages.some(message => message.id === turn.message.id)) throw new SessionError("消息已接收，请同步会话。", 409);
        messages = [...messages, turn.message];
      }
      if (messages.length > 80) throw new SessionError("这段对话已较长，请新建对话继续。", 400);
      messages = messages.map((message, index) => index === messages.length - 1 ? {...message, metadata: {...message.metadata, context: {cityId: state.cityId, listingId: state.listingId}}} : message);
    }
    const now = Date.now();
    // Accept the question and acquire its lease in one atomic write. A reload
    // can therefore always identify an accepted turn, even before its first token.
    const result = await (await database()).run("UPDATE sessions SET version=version+1,state=?,messages=?,lease=?,updated=? WHERE owner=? AND id=? AND version=? AND lease<?", [JSON.stringify(state), JSON.stringify(messages), now + 120000, now, owner, id, version, now]);
    if (!result.changes) throw new SessionError("会话正在处理或已在其他页面更新，请刷新后重试。");
    return {...session, version: version + 1, state, messages, processingUntil: now + 120000};
  }
  async function finishSession(owner: string, session: RentalSession, messages: RentalMessage[], state: RentalState, cancelled = false) {
    // A stopped stream may have unfinished tool arguments. Keep completed results
    // but never send an orphaned tool call back to a provider on the next turn.
    const completed = messages.map(message => ({...message, parts: message.parts.filter(part => !part.type.startsWith("tool-") || !("state" in part) || typeof part.state !== "string" || !["input-streaming", "input-available"].includes(part.state))}))
      .filter(message => message.role !== "assistant" || message.metadata?.replyStatus || message.parts.some(part => part.type === "text" || part.type === "reasoning" || part.type.startsWith("tool-")));
    // The version prevents a timed-out request from overwriting a newer turn.
    await (await database()).run(`UPDATE sessions SET state=?,messages=?,lease=0,updated=? WHERE owner=? AND id=? AND version=? AND lease${cancelled ? "=0" : ">0"}`, [JSON.stringify(state), JSON.stringify(completed.slice(-100)), Date.now(), owner, session.id, session.version]);
  }
  async function checkpointState(owner: string, session: RentalSession, state: RentalState) {
    await (await database()).run("UPDATE sessions SET state=? WHERE owner=? AND id=? AND version=? AND lease>?", [JSON.stringify(state), owner, session.id, session.version, Date.now()]);
  }
  async function stopSession(owner: string, id: string, messageId: string) {
    const session = await loadSession(owner, id);
    const last = session.messages.findLast(message => message.role === "user");
    if (last?.id !== messageId || !session.processingUntil || session.processingUntil <= Date.now()) return session;
    await finishSession(owner, session, [...session.messages, {id: randomUUID(), role: "assistant", parts: [], metadata: {replyStatus: "stopped"}}], session.state);
    return loadSession(owner, id);
  }
  async function saveState(owner: string, id: string, version: number, state: RentalState, clear = false) {
    const session = await acquireSession(owner, id, version, state);
    await finishSession(owner, session, clear ? [] : session.messages, state);
    return loadSession(owner, id);
  }
  async function consumeQuota(key: string, maximum: number, milliseconds: number) {
    const now = Date.now();
    // A single conditional UPSERT keeps the quota atomic across Worker instances.
    const result = await (await database()).run(`INSERT INTO quotas (key,count,expires) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,
        expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END
      WHERE expires<=? OR count<?`, [key, now + milliseconds, now, now, now, maximum]);
    if (!result.changes) throw new SessionError("体验版请求次数已达上限，请稍后再试。", 429);
  }
  return {database, loadSession, sessionForCity, acquireSession, finishSession, saveState, consumeQuota, checkpointState, stopSession};
}
export const {database, loadSession, sessionForCity, acquireSession, finishSession, saveState, consumeQuota, checkpointState, stopSession} = createStore(getDatabase);
