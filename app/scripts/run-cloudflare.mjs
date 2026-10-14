import { spawnSync } from "node:child_process";

const [command, ...args] = process.argv.slice(2);
if (!["build", "dev"].includes(command)) throw new Error("Expected build or dev.");
for (const script of [["scripts/prepare-cesium.mjs"], ["--import", "tsx", "scripts/prepare-cloudflare.ts"]]) {
  const result = spawnSync(process.execPath, script, {stdio: "inherit"});
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Server secrets are intentionally not loaded into the build process. Local
// Worker development can use ignored .dev.vars; deployment uses Wrangler secrets.
process.argv = [process.execPath, "vite", ...(command === "build" ? ["build"] : []), "--config", "vite.cloudflare.config.ts", ...args];
await import("../node_modules/vite/bin/vite.js");
