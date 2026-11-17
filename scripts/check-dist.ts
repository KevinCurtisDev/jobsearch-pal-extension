// Checks dist/ after a build: permission budget, manifest limits, referenced files, no remote code.
// Run by `npm run verify`. Fails with a list of problems.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { bannedCode, checkManifest, referencedFiles, type Budget } from "./dist-rules.ts";

const dist = "dist";
const errors: string[] = [];
const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8")) as Record<string, unknown>;
const config = JSON.parse(readFileSync("extension.config.json", "utf8")) as { permissions: Budget };
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

errors.push(...checkManifest(manifest, config.permissions, pkg.version));
for (const f of referencedFiles(manifest)) if (!existsSync(join(dist, f))) errors.push(`manifest references missing file ${f}`);

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
for (const file of walk(dist)) {
  if (!/\.(m?js|html)$/.test(file)) continue;
  for (const hit of bannedCode(readFileSync(file, "utf8"))) errors.push(`${relative(dist, file)}: ${hit}`);
}

if (errors.length) {
  console.error("✖ dist/ check failed:\n - " + errors.join("\n - "));
  process.exit(1);
}
const perms = config.permissions.permissions;
console.log(`✔ dist/ OK: Manifest V3, permissions [${perms.join(", ") || "none"}], no remote code`);
