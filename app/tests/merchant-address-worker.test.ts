import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { build } from "esbuild";
import { Miniflare, createFetchMock } from "miniflare";
import { schema } from "../lib/agent/database";

test("production address lookup runs inside Workers and refuses redirects", async () => {
  const compiled = await build({
    stdin: {
      contents: `import {createAddressSearch} from './lib/merchant/geocoding';
    import {getDatabase} from './lib/agent/database-cloudflare';
    export default {async fetch(request){try{return Response.json(await createAddressSearch(await getDatabase())(await request.json(),'worker-test'));}catch(e){return Response.json({error:e.message},{status:e.status??500});}}};`,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "es2022",
    alias: { "@atlas/database": resolve("lib/agent/database-cloudflare.ts") },
    external: ["node:*", "cloudflare:*"],
  });
  const mock = createFetchMock();
  mock.disableNetConnect();
  const pool = mock.get("https://nominatim.openstreetmap.org");
  pool
    .intercept({ path: /^\/search\?/, method: "GET" })
    .reply(200, [
      {
        lat: "51.5246",
        lon: "-0.134",
        display_name: "Gower Street, London",
        osm_type: "way",
        osm_id: 12,
        addresstype: "road",
        address: {
          country_code: "gb",
          postcode: "WC1E 6BT",
          suburb: "Bloomsbury",
        },
      },
    ]);
  const runtime = new Miniflare({
    modules: true,
    script: compiled.outputFiles[0].text,
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: { ATLAS_DB: "address-worker-test" },
    fetchMock: mock,
    cf: false,
  });
  try {
    const db = await runtime.getD1Database("ATLAS_DB");
    await db.batch(
      schema
        .split(";")
        .filter((s) => s.trim())
        .map((s) => db.prepare(s)),
    );
    const query = {
      cityId: "london",
      address: "Gower Street",
      postcode: "",
      locale: "en",
    };
    const response = await runtime.dispatchFetch("http://test/address", {
      method: "POST",
      body: JSON.stringify(query),
    });
    const data = (await response.json()) as {
      results?: { label: string }[];
      error?: string;
    };
    assert.equal(response.status, 200, JSON.stringify(data));
    assert.equal(data.results?.[0].label, "Gower Street, London");
    await db.prepare("DELETE FROM quotas WHERE key='address:upstream'").run();
    pool
      .intercept({ path: /^\/search\?/, method: "GET" })
      .reply(302, "", { headers: { location: "https://untrusted.example/" } });
    const redirect = await runtime.dispatchFetch("http://test/address", {
      method: "POST",
      body: JSON.stringify({ ...query, address: "Redirect Street" }),
    });
    assert.equal(redirect.status, 503);
    assert.match(
      ((await redirect.json()) as { error: string }).error,
      /Address service unavailable/,
    );
    mock.assertNoPendingInterceptors();
  } finally {
    await runtime.dispose();
    await mock.close();
  }
});
