import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
process.env.WRANGLER_SEND_METRICS ??= "false";
process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";

export default defineConfig({
  plugins: [vinext({nextConfig: {typescript: {tsconfigPath: "tsconfig.cloudflare.json"}}}), cloudflare({configPath: "cloudflare/wrangler.jsonc", viteEnvironment: {name: "rsc", childEnvironments: ["ssr"]}, inspectorPort: false})],
});
