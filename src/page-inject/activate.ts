// Capture pipeline for the service worker (SPEC §3 F2, F3). One activation = check the tab URL (X3
// sites and pages Chrome won't script get a URL-only draft and nothing is injected), one atomic probe
// for an existing page script, a file injection only if needed, then CAPTURE_JOB to the top frame and
// a validated reply. Activations are queued per tab, so rapid repeats run one after another.
import { manualDraft, type DraftDeps } from "../core/draft";
import { CAPTURE_JOB, parseCaptureReply, type CaptureJob } from "../shared/messages";
import { PRODUCT } from "../shared/product";
import type { TabDraft } from "./report";
import { isFileUrl, reasonFromError, reasonFromUrl, type Reason } from "./reasons";

export type ActivationResult =
  | { kind: "captured"; entry: TabDraft }
  /** Nothing to save: the page can't be scripted and has no http(s) URL (browser pages, local files). */
  | { kind: "unavailable"; reason: Reason; message?: string }
  /** The tab closed or navigated away mid-activation. Nothing to explain; the user can try again. */
  | { kind: "gone"; message: string };

export type ActivationDeps = { newId: () => string; now: () => string };

/**
 * Runs in the page's isolated world via executeScript({ func }). It is serialised to a string, so it
 * must stay self-contained: no imports and no outer references.
 */
export function probe(flag: string): "present" | "absent" | "pdf" {
  if (document.contentType === "application/pdf") return "pdf";
  const w = window as unknown as Record<string, unknown>;
  const h = w[flag] as { alive?: () => boolean; retire?: () => void } | undefined;
  if (h && typeof h === "object") {
    if (typeof h.alive === "function" && h.alive()) return "present";
    // Left over from before an extension reload or update: replace it.
    try {
      h.retire?.();
    } catch {
      /* it's going anyway */
    }
    delete w[flag];
  }
  return "absent";
}

const GONE_RE = /no tab with id|tab was closed|tab not found|frame with id \d+ was removed|frame was removed|tab was discarded/i;
const queue = new Map<number, Promise<ActivationResult>>();

export function activateTab(tabId: number, deps: ActivationDeps): Promise<ActivationResult> {
  const prev = queue.get(tabId) ?? Promise.resolve(null);
  const next = prev.then(() => run(tabId, deps));
  queue.set(tabId, next);
  void next.then(() => {
    if (queue.get(tabId) === next) queue.delete(tabId);
  });
  return next;
}

type TabInfo = { url: string | undefined; title: string | undefined; loading: boolean };

async function tabInfo(tabId: number): Promise<TabInfo | null> {
  try {
    const t = await chrome.tabs.get(tabId); // url and title are visible only with an activeTab grant
    return { url: t.url, title: t.title, loading: t.status === "loading" };
  } catch {
    return null;
  }
}

/** A URL-only draft from the tab (F3), or "unavailable" when the tab has no http(s) URL. */
function urlOnly(reason: Reason, tab: TabInfo, d: DraftDeps, message?: string): ActivationResult {
  const draft = manualDraft(tab.url, tab.title, d);
  if (draft) return { kind: "captured", entry: { mode: "url-only", reason, draft } };
  return message === undefined ? { kind: "unavailable", reason } : { kind: "unavailable", reason, message };
}

async function run(tabId: number, deps: ActivationDeps): Promise<ActivationResult> {
  const tab = await tabInfo(tabId);
  if (!tab) return { kind: "gone", message: "tab closed" };
  // Without a URL we can't prove the page isn't an X3 site, so nothing is injected.
  if (!tab.url) return { kind: "unavailable", reason: "no-access" };
  const d: DraftDeps = { id: deps.newId(), now: deps.now() };
  try {
    const fileAccess = isFileUrl(tab.url) ? await chrome.extension.isAllowedFileSchemeAccess() : true;
    const known = reasonFromUrl(tab.url, fileAccess);
    if (known) return urlOnly(known, tab, d);

    const [found] = await chrome.scripting.executeScript({ target: { tabId }, func: probe, args: [PRODUCT.pageFlag] });
    if (found?.result === "pdf") return urlOnly("pdf", tab, d);
    if (found?.result !== "present") await chrome.scripting.executeScript({ target: { tabId }, files: ["page.js"] });
    const msg: CaptureJob = { type: CAPTURE_JOB, v: 1, id: d.id, now: d.now };
    const reply: unknown = await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 });
    const draft = parseCaptureReply(reply, d.id);
    if (draft) return { kind: "captured", entry: { mode: "page", draft } };
    return urlOnly("blocked", tab, d);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (GONE_RE.test(message)) return { kind: "gone", message };
    const after = await tabInfo(tabId);
    if (!after || after.loading || after.url !== tab.url) return { kind: "gone", message }; // navigation revoked the grant mid-way
    const fileAccess = isFileUrl(after.url) ? await chrome.extension.isAllowedFileSchemeAccess() : true;
    return urlOnly(reasonFromError(message, after.url, fileAccess), after, d, message.slice(0, 200));
  }
}
