import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {verifyClientAssets} from "../scripts/verify-client-assets.mjs";

test("deployment gate detects missing lazy chunks, HTML-as-JS, wrong bytes and stale HTML", async t => {
  const directory = mkdtempSync(join(tmpdir(), "atlas-client-gate-"));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  mkdirSync(join(directory, "_next/static/chunks"), {recursive: true});
  writeFileSync(join(directory, "_next/static/chunks/main.js"), "import('./lazy.js')");
  writeFileSync(join(directory, "_next/static/chunks/lazy.js"), "export const ready = true");
  const fixture = failure => async url => {
    const path = new URL(url).pathname;
    if (!path.startsWith("/_next/")) return new Response(`<script type="module" src="/_next/static/chunks/${failure === "stale" ? "old" : "main"}.js"></script>`, {headers: {"Content-Type": "text/html", "Cache-Control": "no-store"}});
    if (path.endsWith("main.js")) return new Response("import('./lazy.js')", {headers: {"Content-Type": "application/javascript"}});
    return new Response(failure === "html" ? "<html/>" : failure === "bytes" ? "wrong version" : "export const ready = true", {
      status: failure === "missing" ? 404 : 200,
      headers: {"Content-Type": failure === "html" ? "text/html" : "application/javascript"},
    });
  };
  for (const [failure, message] of [["missing", /HTTP 404/], ["html", /wrong MIME type/], ["bytes", /content does not match/], ["stale", /different build/]]) {
    await assert.rejects(verifyClientAssets("https://example.com", directory, fixture(failure)), message);
  }
  assert.equal((await verifyClientAssets("https://example.com", directory, fixture())).verifiedAssets, 2);
});
