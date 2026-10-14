import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ownerHash, SessionError } from "./store";
import { getAuth } from "../auth";

export const privateHeaders = {"Cache-Control": "private, no-store"};
export async function identity(request: Request, create = false) {
  if (/(?:^|;\s*)(?:__Secure-)?atlas-auth\./.test(request.headers.get("cookie") ?? "")) {
    const session = await (await getAuth(request)).api.getSession({headers:request.headers});
    if (session?.user) return {owner:ownerHash(`account:${session.user.id}`),headers:privateHeaders};
  }
  const raw = request.headers.get("cookie")?.split(";").map(c => c.trim()).find(c => c.startsWith("atlas_session="))?.slice(14);
  const valid = raw && /^[a-f0-9]{64}$/.test(raw);
  if (!valid && !create) throw new SessionError("请先加载会话。", 401);
  const token = valid ? raw : randomBytes(32).toString("hex");
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  return {owner: ownerHash(token), headers: {...privateHeaders, ...(!valid ? {"Set-Cookie": `atlas_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7776000${secure ? "; Secure" : ""}`} : {})}};
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url);
  // HTTPS terminates at the existing tunnel/reverse proxy; the host must still match.
  if (request.headers.get("x-forwarded-proto") === "https") expected.protocol = "https:";
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== expected.origin)) throw new SessionError("请在本站发起请求。", 403);
}
export async function readBody(request: Request) {
  sameOrigin(request);
  // A streaming limit also covers chunked requests without Content-Length.
  if (Number(request.headers.get("content-length") || 0) > 32768) throw new SessionError("请求过大。", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new SessionError("请求内容为空。", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {const item = await reader.read(); if (item.done) break; size += item.value.byteLength; if (size > 32768) {await reader.cancel(); throw new SessionError("请求过大。", 413);} chunks.push(item.value);}
  try {return JSON.parse(Buffer.concat(chunks).toString("utf8"));} catch {throw new SessionError("请求格式无效。", 400);}
}
export function errorResponse(error: unknown) {
  return Response.json({error: error instanceof SessionError ? error.message : error instanceof z.ZodError ? "请求参数无效。" : "请求暂时无法完成，请刷新或稍后重试。"},
    {status: error instanceof SessionError ? error.status : error instanceof z.ZodError ? 400 : 500, headers: privateHeaders});
}
