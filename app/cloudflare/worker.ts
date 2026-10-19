import { DurableObject } from "cloudflare:workers";
import { chatLifetime } from "../lib/agent/chat-lifetime";
import handler from "vinext/server/fetch-handler";

type Env = {ASSETS: {fetch(request: Request): Promise<Response>}; ATLAS_CHAT_RUNS: DurableObjectNamespace};

// One bounded turn per session. Pending I/O in a Durable Object survives
// browser disconnects; the ordinary Worker's 30-second waitUntil grace does not.
export class ChatRun extends DurableObject<Env> {
  async fetch(request: Request) {
    const detached = new Request(request, {signal: new AbortController().signal});
    return chatLifetime.run(task => this.ctx.waitUntil(task), () => handler.fetch(detached, this.env, {
      waitUntil: (task: Promise<unknown>) => this.ctx.waitUntil(task),
      passThroughOnException() {},
    } as ExecutionContext));
  }
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (new URL(request.url).pathname === "/api/agent/chat" && request.method === "POST") {
      // Bound the envelope before routing; normal route auth, origin checks,
      // schema validation and quotas still execute inside the object.
      const reader = request.body?.getReader();
      if (!reader) return new Response("Missing body", {status: 400});
      const chunks: Uint8Array[] = []; let size = 0;
      for (;;) {
        const item = await reader.read(); if (item.done) break;
        size += item.value.byteLength;
        if (size > 32768) {await reader.cancel(); return new Response("Too large", {status: 413});}
        chunks.push(item.value);
      }
      const bytes = Buffer.concat(chunks);
      let id: unknown;
      try {id = JSON.parse(bytes.toString()).sessionId;} catch {return new Response("Invalid body", {status: 400});}
      if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) return new Response("Invalid session", {status: 400});
      return env.ATLAS_CHAT_RUNS.getByName(id).fetch(new Request(request, {body: bytes, signal: new AbortController().signal}));
    }
    // Service-binding calls must be able to obtain the assets belonging to this
    // exact Worker release, without falling through to an HTML not-found page.
    if (new URL(request.url).pathname.startsWith("/_next/static/") && ["GET", "HEAD"].includes(request.method)) {
      return env.ASSETS.fetch(request);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
