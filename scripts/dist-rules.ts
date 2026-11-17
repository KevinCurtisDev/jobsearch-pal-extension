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

// G1 network audit (SPEC §6). The extension makes no network requests (X1), so built files may not
// contain network APIs or external URLs. URLs listed in scripts/network-allow.json are exempt; each
// entry is an exact string with a reason. Never add wildcards or patterns.

const NETWORK_APIS: [RegExp, string][] = [
  [/\bfetch\s*\(/g, "fetch("],
  [/\bXMLHttpRequest\b/g, "XMLHttpRequest"],
  [/\bWebSocket\b/g, "WebSocket"],
  [/\bEventSource\b/g, "EventSource"],
  [/\bsendBeacon\b/g, "sendBeacon"],
  [/\bimport\s*\(\s*["'`]https?:/g, "remote import()"]
];
const URL_RE = /https?:\/\/[^\s"'`<>()\\,;]+/g;
const PATTERN_CHARS = /[*^$|\\()[\]{}\s]/;

export type NetworkAllowlist = { allowed: Set<string>; errors: string[] };

/** Validates the parsed scripts/network-allow.json: { entries: [{ url, reason }] }, exact URLs only. */
export function loadNetworkAllowlist(json: unknown): NetworkAllowlist {
  const allowed = new Set<string>();
  const entries = (json as Json | null)?.entries;
  if (!json || typeof json !== "object" || Array.isArray(json) || !Array.isArray(entries)) {
    return { allowed, errors: ['network-allow.json must be an object with an "entries" array'] };
  }
  const errors: string[] = [];
  entries.forEach((e: unknown, i) => {
    const entry = e as Json | null;
    const url = entry && typeof entry === "object" ? entry.url : undefined;
    const reason = entry && typeof entry === "object" ? entry.reason : undefined;
    if (typeof url !== "string" || !/^https?:\/\/./.test(url)) errors.push(`entry ${i}: url must be an http(s) URL string`);
    else if (PATTERN_CHARS.test(url)) errors.push(`entry ${i}: "${url}" looks like a wildcard or pattern; use exact strings`);
    else if (typeof reason !== "string" || !reason.trim()) errors.push(`entry ${i}: "${url}" needs a reason`);
    else allowed.add(url);
  });
  return { allowed, errors };
}

/** Network APIs and non-allowlisted URLs in a built file, one message per hit with line:column. */
export function networkHits(text: string, allowed: ReadonlySet<string>): string[] {
  const hits: { at: number; msg: string }[] = [];
  for (const [re, label] of NETWORK_APIS) for (const m of text.matchAll(re)) hits.push({ at: m.index, msg: label });
  for (const m of text.matchAll(URL_RE)) if (!allowed.has(m[0])) hits.push({ at: m.index, msg: `external URL ${m[0]}` });
  hits.sort((a, b) => a.at - b.at);
  return hits.map(({ at, msg }) => {
    const before = text.slice(0, at);
    const line = before.split("\n").length;
    return `${msg} at ${line}:${at - before.lastIndexOf("\n")}`;
  });
}
