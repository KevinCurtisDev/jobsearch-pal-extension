// Helpers for capture e2e tests. They run through the service worker, which can reach a tab only
// after the toolbar click granted activeTab.
import type { Page, Worker } from "@playwright/test";
import { PRODUCT } from "../../src/shared/product";

export type HandleState = { present: false } | { present: true; instanceId: string };

/** The tab id for a page (the URL is visible to the worker only with a grant). */
export async function tabIdOf(sw: Worker, page: Page): Promise<number> {
  return sw.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
    if (tab?.id === undefined) throw new Error(`no granted tab at ${url}`);
    return tab.id;
  }, page.url());
}

/** Whether the page script's handle exists in the page's isolated world. */
export async function handleState(sw: Worker, page: Page): Promise<HandleState> {
  const tabId = await tabIdOf(sw, page);
  return sw.evaluate(
    async ([id, flag]) => {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: id },
        func: (f: string) => {
          const h = (window as unknown as Record<string, { instanceId: string } | undefined>)[f];
          return h ? { present: true as const, instanceId: h.instanceId } : { present: false as const };
        },
        args: [flag]
      });
      return res!.result as HandleState;
    },
    [tabId, PRODUCT.pageFlag] as [number, string]
  );
}

/** The tab's entry in chrome.storage.session (null if none yet). */
export async function sessionDraft(sw: Worker, tabId: number): Promise<unknown> {
  return sw.evaluate(async (key) => (await chrome.storage.session.get(key))[key] ?? null, `draft.${tabId}`);
}

/** Waits until the worker stored a draft for the page's tab whose id differs from `notId`. */
export async function waitForDraft(sw: Worker, page: Page, notId?: string): Promise<{ mode: string; reason?: string; draft: Record<string, { value: unknown; source: string }> & { id: string } }> {
  const tabId = await tabIdOf(sw, page);
  for (let i = 0; i < 100; i++) {
    const d = (await sessionDraft(sw, tabId)) as { draft?: { id?: string } } | null;
    if (d?.draft?.id && d.draft.id !== notId) return d as never;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("no draft stored for the tab");
}

/** True if page scripts (the main world) can see the handle. They must not. */
export async function visibleToPage(page: Page): Promise<boolean> {
  return page.evaluate((f) => f in window, PRODUCT.pageFlag);
}
