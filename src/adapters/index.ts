// Capture: page → JobDraft (SPEC §3 F2). Bundled into the page script and run only on the user's click
// (X4). JSON-LD comes first; a site adapter fills fields JSON-LD lacks; with neither, the draft is a
// manual one from the tab URL and title. Never throws on page data. X3 hosts are refused before
// injection (src/page-inject), so this module is never reached there.
import { extractJobPosting, MAX_JSONLD_CHARS, provenance, type CapturedFields } from "../core/jsonld";
import { manualDraft, MANUAL_TITLE_CONFIDENCE } from "../core/draft";
import { HttpUrlSchema, JobDraftSchema, type JobDraft } from "../core/model";
import { readGreenhouse } from "./greenhouse";

export type CaptureDeps = { id: string; now: string };
type Adapter = (doc: Document, url: URL, at: string) => CapturedFields | null;

export const ADAPTERS: readonly Adapter[] = [readGreenhouse];

export { MANUAL_TITLE_CONFIDENCE };
const MAX_SCRIPTS = 20;

/** Text of each JSON-LD script on the page (bounded in count and size). */
export function jsonLdScripts(doc: Document): string[] {
  return Array.from(doc.querySelectorAll('script[type="application/ld+json" i]'))
    .slice(0, MAX_SCRIPTS)
    .map((s) => s.textContent ?? "")
    .filter((t) => t.length > 0 && t.length <= MAX_JSONLD_CHARS);
}

/** Fields from `primary` win; `extra` fills only the fields `primary` lacks. */
function merge(primary: CapturedFields | null, extra: CapturedFields | null): CapturedFields | null {
  if (!primary) return extra;
  if (!extra) return primary;
  return { ...extra, ...primary };
}

/**
 * Builds a draft from the page. Returns null only for non-http(s) URLs (nothing to save). The result
 * is validated with `JobDraftSchema`; if structured data fails validation the manual draft is used.
 */
export function captureDraft(doc: Document, pageUrl: string, deps: CaptureDeps): JobDraft | null {
  const urlCheck = HttpUrlSchema.safeParse(pageUrl);
  if (!urlCheck.success) return null;
  const url = new URL(urlCheck.data);
  const at = deps.now;

  let found = extractJobPosting(jsonLdScripts(doc), at);
  for (const adapter of ADAPTERS) {
    try {
      found = merge(found, adapter(doc, url, at));
    } catch {
      // a broken adapter must not break capture
    }
  }

  const base = { id: deps.id, capturedAt: at };
  if (found) {
    const source = found.title.source;
    const draft = JobDraftSchema.safeParse({ ...base, url: provenance(urlCheck.data, source, 1, at), ...found });
    if (draft.success) return draft.data;
  }
  return manualDraft(urlCheck.data, doc.title, deps);
}
