// Licence gate (SPEC §6, ADR-014): every production dependency in package-lock.json must use one of the
// allowed licences, and package.json must pin every dependency exactly. Runs in `npm run verify`; offline.
//   node scripts/licence-check.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ALLOWED_LICENCES: ReadonlySet<string> = new Set(["MIT", "Apache-2.0", "ISC", "BSD-2-Clause", "BSD-3-Clause", "0BSD"]);

const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** "field.name: spec" for each dependency or devDependency not pinned to an exact version. */
export function inexactVersions(pkg: unknown): string[] {
  const out: string[] = [];
  if (!isRecord(pkg)) return ["package.json is not an object"];
  for (const field of ["dependencies", "devDependencies"]) {
    const deps = pkg[field];
    if (!isRecord(deps)) continue;
    for (const [name, spec] of Object.entries(deps)) if (typeof spec !== "string" || !EXACT.test(spec)) out.push(`${field}.${name}: ${String(spec)}`);
  }
  return out;
}

/** "name@version: licence" for each production package whose licence is not allowed (SPDX expressions are not accepted). */
export function licenceProblems(lock: unknown): string[] {
  if (!isRecord(lock) || !isRecord(lock.packages)) return ["package-lock.json has no packages map"];
  const out: string[] = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === "" || !isRecord(entry) || entry.dev === true || entry.devOptional === true) continue;
    const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
    const id = `${name}@${String(entry.version)}`;
    const licence = entry.license;
    if (typeof licence !== "string" || licence === "") out.push(`${id}: no licence`);
    else if (!ALLOWED_LICENCES.has(licence)) out.push(`${id}: ${licence}`);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = [
    ...inexactVersions(JSON.parse(readFileSync("package.json", "utf8"))).map((p) => `not exact: ${p}`),
    ...licenceProblems(JSON.parse(readFileSync("package-lock.json", "utf8"))).map((p) => `licence: ${p}`)
  ];
  for (const p of problems) console.error(`✖ ${p}`);
  if (problems.length) process.exit(1);
  console.log(`✔ licences OK: production dependencies use ${[...ALLOWED_LICENCES].join(", ")}; all versions exact`);
}
