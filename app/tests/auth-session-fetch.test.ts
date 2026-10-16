import test from "node:test";
import assert from "node:assert/strict";
import { createSessionFetch } from "../lib/auth-session-fetch";
const url = "https://campus-atlas-demo.pages.dev/api/auth/get-session";
test("stalled session reads time out and retry once without losing credentials", async () => {
  let calls = 0;
  const request: typeof fetch = async (_input, init) => {
    calls++;
    assert.equal(init?.credentials, "include");
    assert.equal(init?.cache, "no-store");
    if (calls === 1)
      return new Promise((_resolve, reject) =>
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        ),
      );
    return Response.json({ user: { id: "qa" } });
  };
  // Node's AbortSignal timeout is unref'd; keep this isolated test alive.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const r = await createSessionFetch(request, 10)(url, {
      credentials: "include",
    });
    assert.equal(r.status, 200);
    assert.equal(calls, 2);
  } finally {
    clearInterval(keepAlive);
  }
});
test("session failures are bounded and caller cancellation never retries", async () => {
  let calls = 0;
  const request: typeof fetch = async () => {
    calls++;
    throw new Error("offline");
  };
  await assert.rejects(createSessionFetch(request)(url), /offline/);
  assert.equal(calls, 2);
  const controller = new AbortController();
  controller.abort();
  calls = 0;
  await assert.rejects(
    createSessionFetch(request)(url, { signal: controller.signal }),
    { name: "AbortError" },
  );
  assert.equal(calls, 0);
});
test("server errors retry but authorization failures and mutations do not", async () => {
  let calls = 0;
  let code = 503;
  const request: typeof fetch = async () => {
    calls++;
    return new Response(null, { status: code });
  };
  const fetchSession = createSessionFetch(request);
  assert.equal((await fetchSession(url)).status, 503);
  assert.equal(calls, 2);
  calls = 0;
  code = 401;
  assert.equal((await fetchSession(url)).status, 401);
  assert.equal(calls, 1);
  calls = 0;
  code = 503;
  await fetchSession(url, { method: "POST" });
  assert.equal(calls, 1);
  calls = 0;
  await fetchSession(url.replace("get-session", "sign-in/email"), {
    method: "POST",
  });
  assert.equal(calls, 1);
});
