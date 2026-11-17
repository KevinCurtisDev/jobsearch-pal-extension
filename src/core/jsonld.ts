// schema.org JobPosting JSON-LD → captured job fields with provenance (SPEC §3 F2). Pure: the caller
// passes the text of each `<script type="application/ld+json">`. Page data is hostile: every value is
// type-checked, HTML is reduced to plain text, and each field is validated against the model before use.
// Malformed JSON never throws; if no usable JobPosting is found the result is null.
import { FieldSourceSchema, LIMITS, PaySchema, type FieldSource, type JobDraft, type Pay } from "./model";

/** Captured fields without the draft's id, capture time and URL (the caller adds those). */
export type CapturedFields = Omit<JobDraft, "id" | "capturedAt" | "url">;

/** Confidence for values read from a JobPosting: structured data the employer published. */
export const JSONLD_CONFIDENCE = {
  title: 0.95,
  company: 0.9,
  location: 0.85,
  description: 0.9,
  pay: 0.8,
} as const;

/** Inputs larger than this are ignored (characters). Bounds parse and text-reduction time. */
export const MAX_JSONLD_CHARS = 1_000_000;
const MAX_DEPTH = 12;
const MAX_NODES = 5_000;

type Json = unknown;
type Obj = Record<string, Json>;

const isObj = (v: Json): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

// ---------------------------------------------------------------------------------------------
// HTML → text (no DOM: src/core is pure, and DOMParser is banned). A linear scanner, not regexes
// with backtracking, so hostile input can't make it slow.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•", middot: "·", copy: "©", reg: "®",
  trade: "™", euro: "€", pound: "£", yen: "¥", cent: "¢", times: "×", shy: "",
};

/** Decodes HTML character references (named subset, decimal, hex). Unknown references stay as-is. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z]{2,8});/g, (whole, ref: string) => {
    if (ref.startsWith("#")) {
      const cp = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      const ok = cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff);
      return ok ? String.fromCodePoint(cp) : "";
    }
    return NAMED_ENTITIES[ref] ?? NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

const BLOCK_TAGS = new Set([
  "p", "div", "br", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "table", "section",
  "article", "header", "footer", "blockquote", "pre", "hr", "dd", "dt", "dl",
]);
const SKIP_CONTENT_TAGS = new Set(["script", "style", "template", "noscript", "iframe", "svg"]);

/** Collapses runs of spaces within lines, trims lines and drops empty lines. */
export function tidyText(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t\f\v\u00a0]+/g, " ").trim())
    .filter((l) => l !== "" && l !== "•")
    .join("\n");
}

/**
 * Reduces an HTML fragment to plain text: tags removed (block tags become line breaks, list items get
 * a bullet), script/style content dropped, entities decoded. Text that was HTML-escaped once more
 * (`&lt;p&gt;…`, common in JSON-LD) is unescaped first.
 */
export function htmlToText(input: string): string {
  let html = input;
  if (!html.includes("<") && /&lt;\/?[a-zA-Z]/.test(html)) html = decodeEntities(html);
  const lower = html.toLowerCase();
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out += decodeEntities(html.slice(i));
      break;
    }
    out += decodeEntities(html.slice(i, lt));
    const m = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(lt, lt + 40));
    if (!m) {
      // Comment, doctype or a stray "<": skip comments, keep a lone "<" as text.
      if (html.startsWith("<!--", lt)) {
        const end = html.indexOf("-->", lt + 4);
        i = end === -1 ? html.length : end + 3;
      } else if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) {
        const end = html.indexOf(">", lt);
        i = end === -1 ? html.length : end + 1;
      } else {
        out += "<";
        i = lt + 1;
      }
      continue;
    }
    const gt = html.indexOf(">", lt);
    if (gt === -1) break; // unterminated tag: drop the rest
    const name = (m[1] ?? "").toLowerCase();
    const closing = html[lt + 1] === "/";
    i = gt + 1;
    if (!closing && SKIP_CONTENT_TAGS.has(name)) {
      const end = lower.indexOf(`</${name}`, i);
      if (end === -1) break;
      const endGt = html.indexOf(">", end);
      i = endGt === -1 ? html.length : endGt + 1;
      continue;
    }
    if (name === "li" && !closing) out += "\n• ";
    else if (BLOCK_TAGS.has(name)) out += "\n";
    else if (name === "td" || name === "th") out += " ";
  }
  return tidyText(out);
}

/** One-line text: HTML reduced, all whitespace collapsed to single spaces. */
function lineText(v: Json): string | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = htmlToText(String(v)).replace(/\s+/g, " ").trim();
  return s === "" ? undefined : s;
}

// ---------------------------------------------------------------------------------------------
// Finding JobPosting nodes: top-level objects, arrays and `@graph`, nested one level into other nodes
// (e.g. a WebPage's `mainEntity`). Types may be arrays, prefixed or full IRIs, or subtypes whose name
// ends in "JobPosting".

function typeName(t: string): string {
  return t.replace(/^https?:\/\/schema\.org\//i, "").replace(/^schema:/i, "");
}

export function isJobPostingType(t: Json): boolean {
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && /JobPosting$/.test(typeName(x.trim())));
}

function findJobPostings(root: Json): Obj[] {
  const found: Obj[] = [];
  let visited = 0;
  const walk = (v: Json, depth: number): void => {
    if (depth > MAX_DEPTH || visited >= MAX_NODES) return;
    visited++;
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
      return;
    }
    if (!isObj(v)) return;
    if (isJobPostingType(v["@type"])) {
      found.push(v);
      return;
    }
    for (const [k, x] of Object.entries(v)) {
      if (k === "@context") continue;
      if (typeof x === "object" && x !== null) walk(x, depth + 1);
    }
  };
  walk(root, 0);
  return found;
}

function parse(text: string): Json | undefined {
  if (typeof text !== "string" || text.length > MAX_JSONLD_CHARS) return undefined;
  try {
    return JSON.parse(text.trim()) as Json;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Field readers

const first = (v: Json): Json => (Array.isArray(v) ? v[0] : v);

function readName(v: Json): string | undefined {
  const x = first(v);
  if (typeof x === "string") return lineText(x);
  if (isObj(x)) return lineText(x["name"]) ?? lineText(x["legalName"]);
  return undefined;
}

function readAddress(v: Json): string | undefined {
  const a = first(v);
  if (typeof a === "string") return lineText(a);
  if (!isObj(a)) return undefined;
  const parts = [a["addressLocality"], a["addressRegion"], readName(a["addressCountry"])]
    .map((p) => (typeof p === "string" ? lineText(p) : undefined))
    .filter((p): p is string => p !== undefined);
  const unique = parts.filter((p, idx) => parts.indexOf(p) === idx);
  return unique.length > 0 ? unique.join(", ") : lineText(a["streetAddress"]);
}

function readPlace(v: Json): string | undefined {
  if (typeof v === "string") return lineText(v);
  if (!isObj(v)) return undefined;
  return readAddress(v["address"]) ?? lineText(v["name"]);
}

function readLocation(p: Obj): string | undefined {
  const raw = p["jobLocation"];
  const places = (Array.isArray(raw) ? raw : [raw]).slice(0, 10).map(readPlace).filter((x): x is string => !!x);
  const remote = [p["jobLocationType"]].flat().some((t) => typeof t === "string" && /telecommute/i.test(t));
  const all = [...new Set(places)];
  if (remote) all.push("Remote");
  return all.length > 0 ? all.join("; ") : undefined;
}

const UNIT_TO_PERIOD: Record<string, Pay["period"]> = {
  HOUR: "hour", DAY: "day", WEEK: "week", MONTH: "month", YEAR: "year",
};

/** Minor-unit digits for a currency (JPY 0, USD 2, KWD 3), or undefined if the code is unknown. */
function minorDigits(currency: string): number | undefined {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return undefined;
  }
}

function amount(v: Json): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\s*\d+(\.\d+)?\s*$/.test(v.replace(/,/g, "")) ? Number(v.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function readPay(v: Json): Pay | undefined {
  const m = first(v);
  if (!isObj(m)) return undefined;
  const currency = typeof m["currency"] === "string" ? m["currency"].trim().toUpperCase() : "";
  const digits = minorDigits(currency);
  if (digits === undefined) return undefined;
  const q = m["value"];
  const qv: Obj = isObj(q) ? q : { value: q, unitText: m["unitText"] };
  const unit = typeof qv["unitText"] === "string" ? qv["unitText"].trim().toUpperCase() : "";
  const period = UNIT_TO_PERIOD[unit];
  if (!period) return undefined;
  const single = amount(qv["value"]);
  const min = amount(qv["minValue"]) ?? single ?? amount(qv["maxValue"]);
  const max = amount(qv["maxValue"]) ?? single ?? min;
  if (min === undefined || max === undefined) return undefined;
  const scale = 10 ** digits;
  const pay = { currency, period, minMinor: Math.round(min * scale), maxMinor: Math.round(max * scale) };
  const r = PaySchema.safeParse(pay);
  return r.success ? r.data : undefined;
}

// ---------------------------------------------------------------------------------------------

/** Wraps a value with provenance. */
export function provenance<T>(value: T, source: FieldSource, confidence: number, at: string) {
  return { value, source: FieldSourceSchema.parse(source), confidence, at };
}

const within = (s: string | undefined, max: number): string | undefined =>
  s !== undefined && s.length <= max ? s : undefined;

function fieldsFrom(p: Obj, at: string): CapturedFields | null {
  const title = within(lineText(p["title"]) ?? lineText(p["name"]), LIMITS.title);
  if (!title) return null;
  const c = JSONLD_CONFIDENCE;
  const out: CapturedFields = { title: provenance(title, "jsonld", c.title, at) };
  const company = within(readName(p["hiringOrganization"]), LIMITS.company);
  if (company) out.company = provenance(company, "jsonld", c.company, at);
  const location = within(readLocation(p), LIMITS.location);
  if (location) out.location = provenance(location, "jsonld", c.location, at);
  const d = p["description"];
  const description = typeof d === "string" ? within(htmlToText(d) || undefined, LIMITS.description) : undefined;
  if (description) out.description = provenance(description, "jsonld", c.description, at);
  const pay = readPay(p["baseSalary"]) ?? readPay(p["estimatedSalary"]);
  if (pay) out.pay = provenance(pay, "jsonld", c.pay, at);
  return out;
}

const fieldCount = (f: CapturedFields): number => Object.keys(f).length;

/**
 * Reads the first usable JobPosting from the given JSON-LD script texts (the one with the most fields
 * if there are several). `at` is the ISO capture instant recorded on every field. Returns null when no
 * script parses or none holds a JobPosting with a title. Never throws on page data.
 */
export function extractJobPosting(scripts: readonly string[], at: string): CapturedFields | null {
  let best: CapturedFields | null = null;
  for (const text of scripts.slice(0, 50)) {
    const root = parse(text);
    if (root === undefined) continue;
    for (const posting of findJobPostings(root)) {
      const fields = fieldsFrom(posting, at);
      if (fields && (!best || fieldCount(fields) > fieldCount(best))) best = fields;
    }
  }
  return best;
}
