import {existsSync, readdirSync, readFileSync} from "node:fs";

// Read keys only after building, to detect accidental inclusion without logging
// their values. The check also prevents deploying SQLite stubs to a Worker.
if (existsSync(".env.agent.local")) process.loadEnvFile(".env.agent.local");
const secrets = [process.env.ATLAS_AI_API_KEY,process.env.ATLAS_AUTH_SECRET].filter(Boolean);
let secretLeaks = 0, sqliteImports = 0, hasD1 = false;
for (const file of readdirSync("dist", {recursive: true}).filter(file => /\.(js|json|html)$/.test(file))) {
  const source = readFileSync(`dist/${file}`, "utf8");
  if (secrets.some(key => source.includes(key))) {secretLeaks++; console.error("Server secret found in build file:", file);}
  if (source.includes("node:sqlite")) sqliteImports++;
  if (source.includes("Cloudflare D1 binding ATLAS_DB")) hasD1 = true;
}
console.log("Worker build guards:", JSON.stringify({secretLeaks, sqliteImports, hasD1}));
if (secretLeaks || sqliteImports || !hasD1) process.exit(1);
