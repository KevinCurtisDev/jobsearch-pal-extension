// Release readiness checks (run by /prepare-release; nothing is published or uploaded).
//   node scripts/release-check.ts
// Fails on: placeholder icons, unfilled store/privacy drafts, version mismatches, no CHANGELOG entry,
// no store zip for this version, uncommitted changes, or `npm audit --omit=dev` findings (needs network;
// `verify` stays offline, ADR-014).
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

// SHA-256 of the factory's placeholder icons (public/icons/icon{16,32,48,128}.png at generation).
const PLACEHOLDER_ICONS = new Set<string>(["a5cf08c532033021fc53632d4c05c0ef15c4e12bafca400435f25434cd61e5c5","c435d655591a3a7a952699c98d0cdeae52aa8f69b3d3b2e4fdfbeba07457ac55","df202a6b2b82fb9cbb8065d08407d071c86f2eaaa47567f15d98065251b56746","54e9eaeb74958d6769e76a22e7e3cbf7ee06aa9723437d9a9c60c1da7d3fe2c7"]);

const results: [boolean, string][] = [];
const check = (ok: boolean, msg: string) => results.push([ok, msg]);
const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf8") : "");
const json = (f: string) => JSON.parse(read(f) || "{}") as Record<string, unknown>;

const pkg = json("package.json"), manifest = json("src/manifest.json"), config = json("extension.config.json");
const v = String(pkg.version);
check(manifest.version === v && config.version === v, `version ${v} in package.json, src/manifest.json and extension.config.json`);
check(new RegExp(`^## \\[?${v.replace(/\./g, "\\.")}\\]?`, "m").test(read("CHANGELOG.md")), `CHANGELOG.md has a "## ${v}" entry`);
for (const s of [16, 32, 48, 128]) {
  const f = `public/icons/icon${s}.png`;
  const hash = existsSync(f) ? createHash("sha256").update(readFileSync(f)).digest("hex") : "";
  check(!!hash && !PLACEHOLDER_ICONS.has(hash), `${f} is your own artwork (not the factory placeholder)`);
}
for (const f of ["docs/STORE_LISTING.md", "docs/PRIVACY.md"]) check(!!read(f) && !read(f).includes("⟨"), `${f} is filled in (no ⟨placeholders⟩)`);
check(existsSync(`release/${String(config.slug)}-${v}.zip`), `release/${String(config.slug)}-${v}.zip exists (npm run package)`);
function gitClean(): boolean {
  try {
    return execSync("git status --porcelain", { encoding: "utf8" }).trim() === "";
  } catch {
    return false;
  }
}
check(gitClean(), "git working tree is clean (everything committed)");
function auditClean(): boolean {
  try {
    execSync("npm audit --omit=dev", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
check(auditClean(), "npm audit --omit=dev reports no vulnerabilities in runtime dependencies");

for (const [ok, msg] of results) console.log(`${ok ? "✔" : "✖"} ${msg}`);
const failed = results.filter(([ok]) => !ok).length;
console.log(failed ? `\n${failed} item(s) to fix before submitting to the Chrome Web Store.` : "\nReady to submit. Upload the zip yourself in the Chrome Web Store Developer Dashboard.");
process.exit(failed ? 1 : 0);
