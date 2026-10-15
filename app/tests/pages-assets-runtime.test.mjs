import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {Miniflare} from "miniflare";

test("real Workers service binding serves new modules while Pages still contains the old release", async t => {
  const directory = mkdtempSync(join(tmpdir(), "atlas-pages-runtime-"));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  for (const release of ["old", "new"]) {
    const chunks = join(directory, release, "_next/static/chunks");
    mkdirSync(chunks, {recursive: true});
    writeFileSync(join(chunks, `${release}.js`), `export const release = '${release}'`);
  }
  const runtime = new Miniflare({cf: false, workers: [
    {
      name: "pages", modules: true, compatibilityDate: "2026-05-15",
      script: readFileSync(new URL("../cloudflare/pages/entry.mjs", import.meta.url), "utf8"),
      serviceBindings: {ATLAS_APP: "app", ASSETS: "old-pages-assets"},
    },
    {
      name: "app", modules: true, compatibilityDate: "2026-05-15",
      script: `export default {fetch(request, env) {
        if (new URL(request.url).pathname.startsWith('/_next/static/')) return env.ASSETS.fetch(request);
        return new Response('<script type="module" src="/_next/static/chunks/new.js"></script>', {headers: {'Content-Type': 'text/html'}});
      }}`,
      assets: {workerName: "app", directory: join(directory, "new"), binding: "ASSETS", routerConfig: {has_user_worker: true}},
    },
    {
      // Miniflare 4 uses one disk service for asset directories in a runtime.
      // Model the older Pages snapshot with a separate fetch service; the new
      // release above still exercises the real Worker static-assets router.
      name: "old-pages-assets", modules: true, compatibilityDate: "2026-05-15",
      script: `export default {fetch(request) {
        return new URL(request.url).pathname.endsWith('/old.js')
          ? new Response("export const release = 'old'", {headers: {'Content-Type': 'application/javascript'}})
          : new Response('Not Found', {status: 404});
      }}`,
    },
  ]});
  t.after(() => runtime.dispose());
  const html = await runtime.dispatchFetch("https://example.com/");
  assert.match(await html.text(), /new\.js/);
  for (const [release, source] of [["new", "worker"], ["old", "pages-fallback"]]) {
    const response = await runtime.dispatchFetch(`https://example.com/_next/static/chunks/${release}.js`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-atlas-asset-source"), source);
    assert.equal(await response.text(), `export const release = '${release}'`);
  }
});
