// Sets the product version everywhere it appears: package.json, package-lock.json (root entries),
// src/manifest.json and extension.config.json.   node scripts/bump.ts 1.0.0
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const v = process.argv[2] ?? "";
const m = /^(\d{1,5})\.(\d{1,5})\.(\d{1,5})$/.exec(v);
if (!m || m.slice(1).some((n) => Number(n) > 65535)) {
  console.error("Usage: node scripts/bump.ts <major.minor.patch>, each part 0–65535");
  process.exit(2);
}
const edit = (file: string, fn: (j: Record<string, unknown>) => void) => {
  if (!existsSync(file)) return;
  const j = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  fn(j);
  writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
  console.log(`✔ ${file} → ${v}`);
};
edit("package.json", (j) => (j.version = v));
edit("package-lock.json", (j) => {
  j.version = v;
  const root = (j.packages as Record<string, Record<string, unknown>> | undefined)?.[""];
  if (root) root.version = v;
});
edit("src/manifest.json", (j) => (j.version = v));
edit("extension.config.json", (j) => (j.version = v));
console.log("Add a CHANGELOG.md entry for this version, then run npm run verify.");
