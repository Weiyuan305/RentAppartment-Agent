import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {execFileSync} from "node:child_process";

const directory = mkdtempSync(join(tmpdir(), "atlas-pages-assets-"));
mkdirSync(join(directory, "dist/client"), {recursive: true});
writeFileSync(join(directory, "package.json"), '{"type":"module"}');
writeFileSync(join(directory, "dist/client/favicon.svg"), "<svg/>");
execFileSync(process.execPath, [new URL("../scripts/prepare-pages.mjs", import.meta.url).pathname], {cwd: directory});
const routes = JSON.parse(readFileSync(join(directory, "dist/pages/_routes.json"), "utf8"));
const entry = (await import(pathToFileURL(join(directory, "dist/pages/_worker.js")).href)).default;
rmSync(directory, {recursive: true, force: true});
const assetPath = "/_next/static/chunks/";
const request = path => new Request(`https://campus-atlas-demo.pages.dev${path}`);
const javascript = content => new Response(content, {headers: {"Content-Type": "application/javascript", "Cache-Control": "public, max-age=31536000, immutable"}});
const missing = () => new Response("Not Found", {status: 404});
const bindings = (current, pages) => ({
  ATLAS_APP: {fetch: async req => current(new URL(req.url).pathname, req)},
  ASSETS: {fetch: async req => pages(new URL(req.url).pathname, req)},
});

test("account, merchant and moderation pages reach the application rather than the static CDN", async () => {
  for (const path of ["/login", "/privacy", "/merchant", "/admin", "/inquiries"]) {
    assert.ok(routes.include.includes(path), `${path} must be a dynamic Pages route`);
    const response = await entry.fetch(request(path), bindings(() => new Response("auth page"), () => {throw new Error("Auth pages must not use the static fallback");}));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "auth page");
  }
});

test("Pages routes new hashed chunks through the app during the Worker/Pages deployment gap", async () => {
  assert.ok(routes.include.some(pattern => pattern.endsWith("*") ? `${assetPath}new.js`.startsWith(pattern.slice(0, -1)) : pattern === `${assetPath}new.js`), "hashed assets must reach the Pages entry, not only the old CDN snapshot");
  const env = bindings(path => path === "/" ? new Response('<script type="module" src="/_next/static/chunks/new.js"></script>') : javascript("export const version = 'new'"), missing);
  assert.match(await (await entry.fetch(request("/"), env)).text(), /new\.js/);
  assert.equal(await (await entry.fetch(request(`${assetPath}new.js`), env)).text(), "export const version = 'new'");
});

test("a page opened before the Worker switch can still obtain its old lazy chunk from Pages", async () => {
  const response = await entry.fetch(request(`${assetPath}old.js`), bindings(missing, () => javascript("export const version = 'old'")));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "export const version = 'old'");
});

test("a transient asset upstream failure uses the Pages copy without reloading the page", async () => {
  const response = await entry.fetch(request(`${assetPath}same.js`), bindings(() => {throw new TypeError("fetch failed");}, () => javascript("export const ready = true")));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /ready/);
});

test("missing scripts and HTML error responses are never cached as immutable JavaScript", async () => {
  for (const backend of [missing, () => new Response("<html>Error</html>", {headers: {"Content-Type": "text/html", "Cache-Control": "public, max-age=31536000"}})]) {
    const response = await entry.fetch(request(`${assetPath}missing.js`), bindings(backend, backend));
    assert.ok(response.status >= 400);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  }
});

test("API requests, streaming bodies and session cookies pass through once without asset fallback", async () => {
  let calls = 0;
  const req = new Request("https://campus-atlas-demo.pages.dev/api/agent/chat", {method: "POST", headers: {Cookie: "session=test", Origin: "https://campus-atlas-demo.pages.dev"}, body: "message"});
  const response = await entry.fetch(req, bindings(async (_, forwarded) => {
    calls++;
    assert.equal(forwarded, req);
    assert.equal(await forwarded.text(), "message");
    return new Response("data: hello\n\n", {headers: {"Content-Type": "text/event-stream", "Set-Cookie": "session=test; HttpOnly", "Cache-Control": "no-store"}});
  }, () => {throw new Error("API must not fall back to static assets");}));
  assert.equal(calls, 1);
  assert.match(response.headers.get("Set-Cookie"), /HttpOnly/);
  assert.equal(await response.text(), "data: hello\n\n");
});
