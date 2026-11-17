// Checks dist/ after a build: permission budget, locales, manifest limits, referenced files, no remote
// code, no network (G1), no old brand names in dist/ or shipped source (G6).
// Run by `npm run verify`. Fails with a list of problems.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  bannedCode, brandHits, checkLocale, checkManifest, loadMessages, loadNetworkAllowlist, networkHits, referencedFiles, resolveMessages, type Budget
} from "./dist-rules.ts";

const dist = "dist";
const errors: string[] = [];
const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8")) as Record<string, unknown>;
const config = JSON.parse(readFileSync("extension.config.json", "utf8")) as { name: string; permissions: Budget };
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

const network = loadNetworkAllowlist(JSON.parse(readFileSync("scripts/network-allow.json", "utf8")));
errors.push(...network.errors.map((e) => `scripts/network-allow.json ${e}`));
const localeFile = join(dist, "_locales", String(manifest.default_locale), "messages.json");
const locale = existsSync(localeFile) ? loadMessages(JSON.parse(readFileSync(localeFile, "utf8"))) : { messages: {}, errors: [`missing ${localeFile}`] };
errors.push(...locale.errors, ...checkLocale(manifest, locale.messages, config.name));
const resolved = resolveMessages(manifest, locale.messages);
errors.push(...resolved.errors, ...checkManifest(resolved.manifest, config.permissions, pkg.version));
for (const f of referencedFiles(manifest)) if (!existsSync(join(dist, f))) errors.push(`manifest references missing file ${f}`);

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
for (const file of walk(dist)) {
  if (!/\.(m?js|html|css|json)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  if (/\.(m?js|html)$/.test(file)) for (const hit of bannedCode(text)) errors.push(`${relative(dist, file)}: ${hit}`);
  for (const hit of networkHits(text, network.allowed)) errors.push(`${relative(dist, file)}: G1 network: ${hit}`);
}

// G6: every file in dist/ and the shipped source (docs/ is not scanned).
const shipped = [dist, "src", "public", "_locales"].filter(existsSync).flatMap(walk).concat(["build.json", "extension.config.json"]);
for (const file of shipped) for (const hit of brandHits(readFileSync(file, "utf8"))) errors.push(`${file}: G6 brand: ${hit}`);

if (errors.length) {
  console.error("✖ dist/ check failed:\n - " + errors.join("\n - "));
  process.exit(1);
}
const perms = config.permissions.permissions;
console.log(`✔ dist/ OK: Manifest V3, permissions [${perms.join(", ") || "none"}], locales resolved, no remote code, no network, no old brand names`);
