// Injection pipeline for the service worker. One activation = one atomic probe (toggle an existing
// instance, or report that none exists), then a file injection only if needed, then reading the
// page's report. Activations are queued per tab, so rapid repeats toggle instead of racing.
import { PRODUCT } from "../shared/product";
import { parseReport, type PageReport } from "./report";
import { isFileUrl, reasonFromError, reasonFromUrl, type Reason } from "./reasons";

export type ActivationResult =
  | { kind: "injected"; report: PageReport | null }
  | { kind: "toggled"; report: PageReport | null }
  | { kind: "unavailable"; reason: Reason; message?: string }
  /** The tab closed or navigated away mid-activation. Nothing to explain; the user can try again. */
  | { kind: "gone"; message: string };

/**
 * Runs in the page's isolated world via executeScript({ func }). It is serialised to a string, so it
 * must stay self-contained: no imports and no outer references.
 */
export function probeAndToggle(flag: string): "toggled" | "absent" | "pdf" {
  if (document.contentType === "application/pdf") return "pdf";
  const w = window as unknown as Record<string, unknown>;
  const h = w[flag] as { toggle?: () => void; alive?: () => boolean; retire?: () => void } | undefined;
  if (h && typeof h.toggle === "function") {
    if (typeof h.alive !== "function" || h.alive()) {
      h.toggle();
      return "toggled";
    }
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

/** Runs in the page (isolated world): the current report from the handle. Self-contained. */
export function readReport(flag: string): unknown {
  const h = (window as unknown as Record<string, unknown>)[flag] as { report?: () => unknown } | undefined;
  return typeof h?.report === "function" ? h.report() : null;
}

const GONE_RE = /no tab with id|tab was closed|tab not found|frame with id \d+ was removed|frame was removed|tab was discarded/i;
const queue = new Map<number, Promise<ActivationResult>>();

export function activateTab(tabId: number): Promise<ActivationResult> {
  const prev = queue.get(tabId) ?? Promise.resolve(null);
  const next = prev.then(() => run(tabId));
  queue.set(tabId, next);
  void next.then(() => {
    if (queue.get(tabId) === next) queue.delete(tabId);
  });
  return next;
}

async function tabUrl(tabId: number): Promise<{ url: string | undefined; loading: boolean } | null> {
  try {
    const t = await chrome.tabs.get(tabId); // url is visible only with an activeTab grant
    return { url: t.url, loading: t.status === "loading" };
  } catch {
    return null;
  }
}

async function run(tabId: number): Promise<ActivationResult> {
  const tab = await tabUrl(tabId);
  if (!tab) return { kind: "gone", message: "tab closed" };
  try {
    const fileAccess = isFileUrl(tab.url) ? await chrome.extension.isAllowedFileSchemeAccess() : true;
    const known = reasonFromUrl(tab.url, fileAccess);
    if (known) return { kind: "unavailable", reason: known };

    const [probe] = await chrome.scripting.executeScript({ target: { tabId }, func: probeAndToggle, args: [PRODUCT.pageFlag] });
    if (probe?.result === "pdf") return { kind: "unavailable", reason: "pdf" };
    const kind = probe?.result === "toggled" ? "toggled" : "injected";
    if (kind === "injected") await chrome.scripting.executeScript({ target: { tabId }, files: ["page.js"] });
    const [rep] = await chrome.scripting.executeScript({ target: { tabId }, func: readReport, args: [PRODUCT.pageFlag] });
    return { kind, report: parseReport(rep?.result) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (GONE_RE.test(message)) return { kind: "gone", message };
    const after = await tabUrl(tabId);
    if (!after || after.loading) return { kind: "gone", message }; // navigation revoked the grant mid-way
    const fileAccess = isFileUrl(after.url) ? await chrome.extension.isAllowedFileSchemeAccess() : true;
    return { kind: "unavailable", reason: reasonFromError(message, after.url, fileAccess), message: message.slice(0, 200) };
  }
}
