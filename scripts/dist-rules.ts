// Pure checks for the built extension (used by scripts/check-dist.ts and unit tests).
// The permission budget lives in extension.config.json. Widening it is a deliberate, reviewed change:
// never edit these rules to make a build pass.

export type Budget = { permissions: string[]; hostPermissions: string[] };
type Json = Record<string, unknown>;

const STRICT_CSP = "script-src 'self'; object-src 'none'; base-uri 'none'";
const sorted = (a: unknown): string[] => (Array.isArray(a) ? a.map(String).sort() : []);

export function checkManifest(m: Json, budget: Budget, pkgVersion: string): string[] {
  const errors: string[] = [];
  if (m.manifest_version !== 3) errors.push("manifest_version must be 3");
  const perms = sorted(m.permissions);
  const want = [...budget.permissions].sort();
  if (JSON.stringify(perms) !== JSON.stringify(want)) {
    errors.push(`permissions must be exactly [${want.join(", ")}] (extension.config.json); got [${perms.join(", ")}]`);
  }
  const hosts = sorted(m.host_permissions);
  const wantHosts = [...budget.hostPermissions].sort();
  if (JSON.stringify(hosts) !== JSON.stringify(wantHosts)) {
    errors.push(`host_permissions must be exactly [${wantHosts.join(", ")}]; got [${hosts.join(", ")}]`);
  }
  for (const k of ["optional_permissions", "optional_host_permissions", "content_scripts", "externally_connectable", "web_accessible_resources"]) {
    if (k in m) errors.push(`"${k}" is not allowed by the permission budget`);
  }
  const csp = (m.content_security_policy as Json | undefined)?.extension_pages;
  if (csp !== STRICT_CSP) errors.push(`content_security_policy.extension_pages must be "${STRICT_CSP}"`);
  if (m.version !== pkgVersion) errors.push(`manifest version ${String(m.version)} differs from package.json version ${pkgVersion}`);
  if (typeof m.name !== "string" || m.name.length > 75) errors.push("name must be a string of at most 75 characters");
  if (typeof m.short_name === "string" && m.short_name.length > 12) errors.push("short_name must be at most 12 characters");
  if (typeof m.description !== "string" || m.description.length > 132) errors.push("description must be at most 132 characters");
  return errors;
}

/** Files the manifest points at, relative to dist/. */
export function referencedFiles(m: Json): string[] {
  const files = new Set<string>();
  const bg = (m.background as Json | undefined)?.service_worker;
  if (typeof bg === "string") files.add(bg);
  const action = m.action as Json | undefined;
  if (typeof action?.default_popup === "string") files.add(action.default_popup);
  for (const icons of [m.icons, action?.default_icon]) {
    if (icons && typeof icons === "object") for (const v of Object.values(icons)) files.add(String(v));
  }
  if (typeof m.options_page === "string") files.add(m.options_page);
  const ui = (m.options_ui as Json | undefined)?.page;
  if (typeof ui === "string") files.add(ui);
  return [...files].sort();
}

const BANNED_CODE: [RegExp, string][] = [
  [/\beval\s*\(/, "eval("],
  [/\bnew\s+Function\s*\(/, "new Function("],
  [/importScripts\s*\(\s*["']https?:/, "remote importScripts"],
  [/<script[^>]+src\s*=\s*["']https?:/i, "remote <script src>"],
  [/import\s*\(\s*["']https?:/, "remote dynamic import"]
];

/** Remote or dynamic code in a built JS or HTML file (MV3 forbids remotely hosted code). */
export function bannedCode(text: string): string[] {
  return BANNED_CODE.filter(([re]) => re.test(text)).map(([, label]) => label);
}
