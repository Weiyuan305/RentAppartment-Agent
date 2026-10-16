import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync, readdirSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");

// Check the entire client module set, including lazy chunks not requested by
// the initial HTML. A healthy /api/health alone cannot detect a broken UI.
export async function verifyClientAssets(origin, clientDirectory, fetchImpl = fetch) {
  const base = new URL(origin).origin;
  const directory = resolve(clientDirectory);
  const files = readdirSync(`${directory}/_next/static`, {recursive: true})
    .filter(file => /\.(m?js|css)$/.test(file))
    .map(file => `/_next/static/${file}`);
  assert.ok(files.length > 0, "No client build found");
  const get = path => fetchImpl(`${base}${path}`, {redirect: "error", signal: AbortSignal.timeout(30000), headers: {"Cache-Control": "no-cache"}});
  for (const path of ["/?city=london", "/login", "/setup", "/listing/london-2", "/merchant", "/admin", "/inquiries"]) {
    const response = await get(path);
    assert.equal(response.status, 200, `HTML ${path}: HTTP ${response.status}`);
    assert.match(response.headers.get("content-type") || "", /^text\/html/i);
    assert.match(response.headers.get("cache-control") || "", /no-store|no-cache|private/i, `HTML ${path} must not outlive its release`);
    const html = await response.text();
    const referenced = [...new Set(html.match(/\/_next\/static\/[^"\s<>\\]+\.(?:m?js|css)/g))];
    assert.ok(referenced.length, `HTML ${path} has no client entry`);
    for (const asset of referenced) assert.ok(files.includes(asset), `HTML ${path} references a different build: ${asset}`);
  }
  const pending = [...files];
  let checked = 0;
  const sources = {};
  await Promise.all(Array.from({length: 4}, async () => {
    while (pending.length) {
      const path = pending.shift();
      const response = await get(path);
      assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
      const expectedType = path.endsWith(".css") ? /^text\/css\b/i : /^(application|text)\/(javascript|ecmascript)\b/i;
      assert.match(response.headers.get("content-type") || "", expectedType, `${path}: wrong MIME type`);
      assert.equal(digest(Buffer.from(await response.arrayBuffer())), digest(readFileSync(`${directory}${path}`)), `${path}: content does not match the build`);
      const source = response.headers.get("x-atlas-asset-source") || "direct";
      sources[source] = (sources[source] || 0) + 1;
      checked++;
    }
  }));
  return {origin: base, htmlPages: 7, verifiedAssets: checked, sources};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await verifyClientAssets(process.argv[2] || "https://campus-atlas-demo.pages.dev", "dist/client"), null, 2));
}
