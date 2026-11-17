// Injected into the page's isolated world by src/page-inject/activate.ts (never the page's own world,
// so page scripts can't see or call it). Publishes one handle per page on window[PRODUCT.pageFlag];
// the service worker's probe toggles it on later activations instead of injecting again.
import { PRODUCT } from "../shared/product";
import { collectReport } from "./collect";
import { createView } from "./view";

type Handle = {
  version: 1;
  instanceId: string;
  toggle(): void;
  isVisible(): boolean;
  report(): ReturnType<typeof collectReport>;
  /** True once the service worker acknowledged this page's report message. */
  acked(): boolean;
  alive(): boolean;
  retire(): void;
};

const w = window as unknown as Record<string, unknown>;
if (!w[PRODUCT.pageFlag]) {
  const view = createView();
  let visible = true;
  let acked = false;
  const report = () => collectReport(document, location);
  const alive = () => {
    try {
      return typeof chrome.runtime?.id === "string";
    } catch {
      return false;
    }
  };
  const handle: Handle = {
    version: 1,
    instanceId: crypto.randomUUID(),
    toggle() {
      visible = !visible;
      if (visible) view.show(report());
      else view.hide();
    },
    isVisible: () => visible,
    report,
    acked: () => acked,
    alive,
    retire() {
      view.destroy();
    }
  };
  w[PRODUCT.pageFlag] = handle;
  const first = report();
  view.show(first);
  chrome.runtime.sendMessage({ type: "page:report", report: first }).then(
    (reply: unknown) => (acked = typeof reply === "object" && reply !== null && (reply as { ok?: unknown }).ok === true),
    () => (acked = false)
  );
}
