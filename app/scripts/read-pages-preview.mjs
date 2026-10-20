import { appendFileSync, readFileSync } from "node:fs";

const productionHost = "campus-atlas-demo.pages.dev";

function pagesUrl(value) {
  if (!value.startsWith("https://")) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".pages.dev")) return null;
    return url;
  } catch {
    return null;
  }
}

const entries = readFileSync(process.env.WRANGLER_OUTPUT_FILE_PATH, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const detailed = entries.findLast((entry) => entry.type === "pages-deploy-detailed");
const basic = entries.findLast((entry) => entry.type === "pages-deploy");
if (detailed?.environment !== "preview") {
  console.error("Refusing a Pages deployment that is not a preview.");
  process.exit(1);
}

const deployment = pagesUrl(detailed.url || basic?.url || "");
const alias = detailed.alias ? pagesUrl(detailed.alias) : null;
if (!deployment || (detailed.alias && !alias)) {
  console.error("Wrangler did not report a Pages preview URL.");
  process.exit(1);
}
if (deployment.hostname === productionHost || alias?.hostname === productionHost) {
  console.error("Refusing the production Pages hostname from a pull request.");
  process.exit(1);
}

const output = process.env.GITHUB_OUTPUT;
const lines = `url=${deployment.href.replace(/\/$/, "")}\nalias=${alias ? alias.href.replace(/\/$/, "") : ""}\n`;
if (!output) {
  process.stdout.write(lines);
} else {
  appendFileSync(output, lines);
}
