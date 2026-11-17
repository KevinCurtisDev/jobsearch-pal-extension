// Greenhouse hosted job boards (SPEC §3 F2): boards.greenhouse.io (classic layout) and
// job-boards.greenhouse.io (current layout), EU variants included. Reads visible page text only, on the
// user's click (X4). Pay is not read: Greenhouse shows it as free text, and JSON-LD covers it when present.
import { LIMITS } from "../core/model";
import { provenance, type CapturedFields } from "../core/jsonld";
import { lineOf, textOf } from "./dom-text";

const HOSTS = new Set([
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "boards.eu.greenhouse.io",
  "job-boards.eu.greenhouse.io",
]);

/** Confidence for values read from Greenhouse page markup (selectors can drift). */
export const GREENHOUSE_CONFIDENCE = { title: 0.85, company: 0.75, location: 0.8, description: 0.8 } as const;

export function isGreenhouse(url: URL): boolean {
  return url.protocol === "https:" && HOSTS.has(url.hostname.toLowerCase());
}

const TITLE = [".job__title h1", "#header .app-title", "h1.app-title", "h1"];
const COMPANY = ["#header .company-name", ".company-name"];
const LOCATION = [".job__location", "#header .location", ".location"];
const DESCRIPTION = [".job__description", "#content"];

/** "at Acme Inc" → "Acme Inc". */
const stripAt = (s: string): string => s.replace(/^at\s+/i, "").trim();

/** Company from og:site_name, or from a tab title ending "at <company>". */
function companyFromMeta(doc: Document): string | undefined {
  const og = doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim();
  if (og && !/greenhouse/i.test(og)) return og;
  // Current layout titles read "Job Application for <title> at <company>".
  const m = /^.*\bat\s+(.+)$/.exec(doc.title.trim()); // last " at "
  return m?.[1]?.trim() || undefined;
}

/**
 * Greenhouse joins places with ";" and the current layout appends "| <office>", which often repeats one of
 * them ("NYC, NY; SF, CA | NYC, NY"). Splits on both, drops repeats (ignoring case) and joins with "; ".
 */
export function normalizeLocation(s: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of s.split(/[;|]/)) {
    const place = part.trim().replace(/\s+/g, " ");
    const key = place.toLowerCase();
    if (place === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(place);
  }
  return out.join("; ");
}

const within = (s: string | undefined, max: number): string | undefined =>
  s !== undefined && s.length > 0 && s.length <= max ? s : undefined;

/** Reads a Greenhouse posting. Returns null off Greenhouse or when no title is found. */
export function readGreenhouse(doc: Document, url: URL, at: string): CapturedFields | null {
  if (!isGreenhouse(url)) return null;
  const c = GREENHOUSE_CONFIDENCE;
  const title = within(lineOf(doc, TITLE), LIMITS.title);
  if (!title) return null;
  const out: CapturedFields = { title: provenance(title, "adapter", c.title, at) };
  const companyText = lineOf(doc, COMPANY);
  const company = within(companyText ? stripAt(companyText) : companyFromMeta(doc), LIMITS.company);
  if (company) out.company = provenance(company, "adapter", c.company, at);
  const locationText = lineOf(doc, LOCATION);
  const location = within(locationText ? normalizeLocation(locationText) : undefined, LIMITS.location);
  if (location) out.location = provenance(location, "adapter", c.location, at);
  for (const sel of DESCRIPTION) {
    const el = doc.querySelector(sel);
    const description = el ? within(textOf(el), LIMITS.description) : undefined;
    if (description) {
      out.description = provenance(description, "adapter", c.description, at);
      break;
    }
  }
  return out;
}
