import {cpSync, mkdirSync, rmSync, writeFileSync} from "node:fs";

// Photos, map files and data remain on Pages' CDN. Framework modules must use
// the live Worker alongside HTML, with this Pages snapshot as a fallback.
rmSync("dist/pages", {recursive: true, force: true});
cpSync("dist/client", "dist/pages", {recursive: true});
cpSync(new URL("../cloudflare/pages/entry.mjs", import.meta.url), "dist/pages/_worker.js");
writeFileSync("dist/pages/_routes.json", JSON.stringify({version: 1, include: ["/", "/api/*", "/login", "/privacy", "/merchant", "/admin", "/inquiries", "/setup", "/listing/*", "/design-lab", "/_next/static/*"], exclude: []}, null, 2));
// Keep Pages config discovery independent of the Vite Worker deploy redirect.
mkdirSync("cloudflare/pages/.wrangler/deploy", {recursive: true});
writeFileSync("cloudflare/pages/.wrangler/deploy/config.json", JSON.stringify({configPath: "../../wrangler.jsonc"}));
console.log("Pages entry prepared: HTML and framework assets use the same Worker release.");
