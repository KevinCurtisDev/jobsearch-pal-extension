// Bundles the extension into dist/. Entry points and static files are listed in build.json
// (written by the factory generator; edit it when you add an entry point or page).
//   npm run build   production: minified, no source maps, __DEV__ = false
//   npm run dev     development: watch mode, inline source maps, __DEV__ = true
import * as esbuild from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tokensToCss } from "./scripts/tokens-css.ts";

const watch = process.argv.includes("--watch");
const prod = !watch;
const out = "dist";
const config = JSON.parse(readFileSync("build.json", "utf8"));

const common = {
  bundle: true,
  target: "chrome120",
  sourcemap: prod ? false : "inline",
  minify: prod,
  legalComments: "none",
  logLevel: "warning",
  define: { __DEV__: JSON.stringify(!prod) }
};

// Group entries by format: service worker and pages as ES modules, injected scripts as IIFE.
const byFormat = new Map();
for (const e of config.entries) {
  if (!byFormat.has(e.format)) byFormat.set(e.format, {});
  byFormat.get(e.format)[e.out] = e.src;
}
const builds = [...byFormat].map(([format, entryPoints]) => ({ ...common, format, entryPoints, outdir: out }));

function copyStatic() {
  const manifest = JSON.parse(readFileSync("src/manifest.json", "utf8"));
  writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
  for (const s of config.static) cpSync(s.from, `${out}/${s.to}`, { recursive: true });
  // The name is localized (__MSG_extName__), so the dev marker goes on the copied message.
  const locale = `${out}/_locales/${manifest.default_locale}/messages.json`;
  if (!prod && existsSync(locale)) {
    const messages = JSON.parse(readFileSync(locale, "utf8"));
    messages.extName.message = `${messages.extName.message} (dev)`;
    writeFileSync(locale, JSON.stringify(messages, null, 2) + "\n");
  }
  if (existsSync("public")) cpSync("public", out, { recursive: true });
  // Design tokens -> CSS variables (ADR-012). Pages link tokens.css; no colour is written anywhere else.
  writeFileSync(`${out}/tokens.css`, tokensToCss(JSON.parse(readFileSync("design/tokens.json", "utf8"))));
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
if (watch) {
  for (const b of builds) await (await esbuild.context(b)).watch();
  copyStatic();
  console.log(`Watching ${out}/ (static files copied once; re-run after manifest or HTML changes)`);
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
  copyStatic();
  console.log(`Built to ${out}/`);
}
