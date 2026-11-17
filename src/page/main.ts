// Injected into the page's isolated world by src/page-inject/activate.ts (never the page's own world,
// so page scripts can't see or call it). It shows nothing and never changes the page: it publishes one
// handle on window[PRODUCT.pageFlag] (so a repeat click doesn't inject again) and answers CAPTURE_JOB
// from the service worker with the draft read from the page.
import { PRODUCT } from "../shared/product";
import { answerCapture } from "./collect";

type Handle = {
  version: 2;
  instanceId: string;
  /** False after an extension reload or update: the worker then retires this instance and injects again. */
  alive(): boolean;
  retire(): void;
};

const w = window as unknown as Record<string, unknown>;
if (!w[PRODUCT.pageFlag]) {
  const listener = (msg: unknown, sender: chrome.runtime.MessageSender, sendResponse: (r: unknown) => void): boolean => {
    const reply = answerCapture(msg, sender, chrome.runtime.id, document, location.href);
    if (reply) sendResponse(reply);
    return false;
  };
  const handle: Handle = {
    version: 2,
    instanceId: crypto.randomUUID(),
    alive() {
      try {
        return typeof chrome.runtime?.id === "string";
      } catch {
        return false;
      }
    },
    retire() {
      try {
        chrome.runtime.onMessage.removeListener(listener);
      } catch {
        /* the old context is gone */
      }
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  w[PRODUCT.pageFlag] = handle;
}
