// Reports the size of the instructions Claude Code loads, and optionally times the quality gate.
//   npm run measure            sizes only
//   npm run measure -- --gate  also times `npm run verify`
//   npm run measure -- --json  machine-readable output
// Sizes are bytes, lines and words. This script does not estimate tokens or savings.
// When dist/ exists it also reports the built bundle: bytes and gzip bytes per file (M1 baseline, SPEC §6).
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

type Row = { file: string; loaded: string; bytes: number; lines: number; words: number };
const rows: Row[] = [];
const add = (file: string, loaded: string) => {
  if (!existsSync(file)) return;
  const t = readFileSync(file, "utf8");
  rows.push({ file, loaded, bytes: Buffer.byteLength(t), lines: t.split("\n").length - (t.endsWith("\n") ? 1 : 0), words: t.split(/\s+/).filter(Boolean).length });
};
const frontmatter = (t: string) => (t.startsWith("---\n") ? t.slice(4, t.indexOf("\n---", 4)) : "");

add("CLAUDE.md", "every session");
const rulesDir = ".claude/rules";
if (existsSync(rulesDir)) {
  for (const f of readdirSync(rulesDir).sort()) {
    const p = join(rulesDir, f);
    add(p, /^paths:/m.test(frontmatter(readFileSync(p, "utf8"))) ? "when matching files are read" : "every session");
  }
}
const skillsDir = ".claude/skills";
let descBytes = 0;
if (existsSync(skillsDir)) {
  for (const d of readdirSync(skillsDir).sort()) {
    const p = join(skillsDir, d, "SKILL.md");
    if (!existsSync(p)) continue;
    const fm = frontmatter(readFileSync(p, "utf8"));
    const desc = /^description:\s*(.*)$/m.exec(fm)?.[1] ?? "";
    // Skills with disable-model-invocation are invoked by you with /name; their descriptions aren't offered to the model.
    if (!/^disable-model-invocation:\s*true/m.test(fm)) descBytes += Buffer.byteLength(desc);
    add(p, "when the skill runs");
  }
}
for (const f of ["PROGRESS.md", "TASKS.md", "SPEC.md", "DECISIONS.md", "REPO-MAP.md"]) add(join("docs", f), "when read");

const always = rows.filter((r) => r.loaded === "every session").reduce((a, r) => a + r.bytes, 0);
const result: Record<string, unknown> = { alwaysLoadedBytes: always, skillDescriptionBytes: descBytes, files: rows };
if (process.argv.includes("--gate")) {
  const t0 = Date.now();
  let ok = true;
  try {
    execSync("npm run -s verify", { stdio: "ignore" });
  } catch {
    ok = false;
  }
  result.verify = { ok, seconds: Math.round((Date.now() - t0) / 100) / 10 };
}
const srcFiles = (d: string): number => (existsSync(d) ? readdirSync(d).reduce((n, f) => n + (statSync(join(d, f)).isDirectory() ? srcFiles(join(d, f)) : 1), 0) : 0);
result.sourceFiles = srcFiles("src");

type BundleRow = { file: string; bytes: number; gzip: number };
const walk = (d: string): string[] => readdirSync(d).sort().flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const bundle: BundleRow[] = existsSync("dist")
  ? walk("dist")
      .filter((f) => /\.(js|css|html|json)$/.test(f))
      .map((f) => {
        const b = readFileSync(f);
        return { file: relative("dist", f), bytes: b.length, gzip: gzipSync(b, { level: 9 }).length };
      })
  : [];
if (bundle.length > 0) result.bundle = { files: bundle, totalBytes: bundle.reduce((a, r) => a + r.bytes, 0), totalGzip: bundle.reduce((a, r) => a + r.gzip, 0) };

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("Loaded            Bytes  Lines  Words  File");
  for (const r of rows) console.log(`${r.loaded.padEnd(17).slice(0, 17)} ${String(r.bytes).padStart(6)} ${String(r.lines).padStart(6)} ${String(r.words).padStart(6)}  ${r.file}`);
  console.log(`\nAlways loaded: ${always} bytes. Model-invocable skill descriptions: ${descBytes} bytes. Source files: ${String(result.sourceFiles)}.`);
  if (result.verify) console.log(`npm run verify: ${JSON.stringify(result.verify)}`);
  if (bundle.length > 0) {
    console.log("\nBundle (dist/)     Bytes    Gzip  File");
    for (const r of bundle) console.log(`${" ".repeat(13)}${String(r.bytes).padStart(9)} ${String(r.gzip).padStart(7)}  ${r.file}`);
    const t = result.bundle as { totalBytes: number; totalGzip: number };
    console.log(`${" ".repeat(13)}${String(t.totalBytes).padStart(9)} ${String(t.totalGzip).padStart(7)}  total`);
  }
}
