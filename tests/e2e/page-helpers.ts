// Helpers for page-inject e2e tests: read the injected script's handle from the page's isolated world
// through the service worker (needs the activeTab grant from a prior activation).
import type { Page, Worker } from "@playwright/test";
import { PRODUCT } from "../../src/shared/product";

export type HandleState = { present: false } | { present: true; instanceId: string; visible: boolean; acked: boolean };

export async function handleState(sw: Worker, page: Page): Promise<HandleState> {
  return sw.evaluate(
    async ([url, flag]) => {
      const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
      if (tab?.id === undefined) throw new Error(`no granted tab at ${url}`);
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (f: string) => {
          const h = (window as unknown as Record<string, { instanceId: string; isVisible(): boolean; acked(): boolean } | undefined>)[f];
          return h ? { present: true as const, instanceId: h.instanceId, visible: h.isVisible(), acked: h.acked() } : { present: false as const };
        },
        args: [flag]
      });
      return res!.result as HandleState;
    },
    [page.url(), PRODUCT.pageFlag] as [string, string]
  );
}

/** Waits until the page script's report message was acknowledged by the service worker. */
export async function waitForAck(sw: Worker, page: Page): Promise<HandleState> {
  for (let i = 0; i < 100; i++) {
    const s = await handleState(sw, page);
    if (s.present && s.acked) return s;
    await new Promise((r) => setTimeout(r, 50));
  }
  return handleState(sw, page);
}

/** True if page scripts (the main world) can see the handle. They must not. */
export async function visibleToPage(page: Page): Promise<boolean> {
  return page.evaluate((f) => f in window, PRODUCT.pageFlag);
}
