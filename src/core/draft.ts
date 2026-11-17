// The manual (URL-only) draft (SPEC §3 F2 fallback, F3): only the tab URL and title. Pure.
import { provenance } from "./jsonld";
import { HttpUrlSchema, JobDraftSchema, LIMITS, type JobDraft } from "./model";

/** Confidence of a title taken from the tab title (often includes the site name). */
export const MANUAL_TITLE_CONFIDENCE = 0.4;

export type DraftDeps = { id: string; now: string };

/** Host name of an absolute http(s) URL already validated by HttpUrlSchema (core has no URL global). */
function hostOf(url: string): string {
  const authority = /^https?:\/\/([^/?#]*)/i.exec(url)?.[1] ?? "";
  const host = authority.slice(authority.lastIndexOf("@") + 1);
  return (host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.replace(/:\d*$/, "")).toLowerCase() || url;
}

/**
 * A draft from the tab URL and title. Returns null for anything but an absolute http(s) URL. A blank
 * title falls back to the host name; a long one is cut at a whitespace-normalised limit.
 */
export function manualDraft(pageUrl: string | undefined, pageTitle: string | undefined, deps: DraftDeps): JobDraft | null {
  const url = HttpUrlSchema.safeParse(pageUrl);
  if (!url.success) return null;
  const title = (pageTitle ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITS.title).trim() || hostOf(url.data);
  const draft = JobDraftSchema.safeParse({
    id: deps.id,
    capturedAt: deps.now,
    url: provenance(url.data, "manual", 1, deps.now),
    title: provenance(title, "manual", MANUAL_TITLE_CONFIDENCE, deps.now),
  });
  return draft.success ? draft.data : null;
}
