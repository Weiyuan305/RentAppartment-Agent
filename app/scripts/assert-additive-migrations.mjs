import { readFileSync } from "node:fs";

// CI applies only unapplied D1 files, and only when they add schema.
// DROP, TRUNCATE, and DELETE FROM remove objects or rows. ON DELETE CASCADE
// is a foreign-key clause and is allowed.
const destructive = /\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i;
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Expected migration files to check.");
  process.exit(1);
}

for (const file of files) {
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ");
  if (destructive.test(source)) {
    console.error(`Refusing non-additive migration: ${file}`);
    process.exit(1);
  }
}

console.log(`Additive migration check passed for ${files.length} file(s).`);
