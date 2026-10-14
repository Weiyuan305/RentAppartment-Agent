import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (existsSync(".env.agent.local")) process.loadEnvFile(".env.agent.local");
const keys = process.argv.includes("--auth-only") ? ["ATLAS_AUTH_SECRET"] : ["ATLAS_AI_BASE_URL", "ATLAS_AI_MODEL", "ATLAS_AI_API_KEY", "ATLAS_AUTH_SECRET"];
const values = Object.fromEntries(keys.map(key => [key, process.env[key]?.trim()]));
if (keys.some(key => !values[key])) throw new Error("Fill server model and authentication configuration in .env.agent.local first.");
if ((values.ATLAS_AUTH_SECRET?.length ?? 0) < 32) throw new Error("ATLAS_AUTH_SECRET must contain at least 32 characters.");
// Pass secret values only through stdin, never shell arguments, logs or Git.
const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "secret", "bulk", "--config", "cloudflare/wrangler.jsonc"], {input: JSON.stringify(values), stdio: ["pipe", "inherit", "inherit"], env: {...process.env, WRANGLER_SEND_METRICS: "false"}});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
