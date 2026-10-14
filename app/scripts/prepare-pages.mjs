import {cpSync, mkdirSync, rmSync, writeFileSync} from "node:fs";

// Pages provides another public hostname. Static assets remain direct CDN
// requests; API and HTML reach the same Worker via an internal service binding.
rmSync("dist/pages", {recursive: true, force: true});
cpSync("dist/client", "dist/pages", {recursive: true});
writeFileSync("dist/pages/_worker.js", `export default {
  fetch(request, env) {return env.ATLAS_APP.fetch(request);}
};\n`);
writeFileSync("dist/pages/_routes.json", JSON.stringify({version: 1, include: ["/", "/api/*", "/login", "/setup", "/listing/*"], exclude: []}, null, 2));
// Keep Pages config discovery independent of the Vite Worker deploy redirect.
mkdirSync("cloudflare/pages/.wrangler/deploy", {recursive: true});
writeFileSync("cloudflare/pages/.wrangler/deploy/config.json", JSON.stringify({configPath: "../../wrangler.jsonc"}));
console.log("Pages entry prepared with static CDN assets and internal Worker routing.");
