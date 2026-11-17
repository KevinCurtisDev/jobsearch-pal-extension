// How the page script shows a report. Without the overlay module it shows nothing on the page.
// (With the overlay module, this file is replaced by one that draws a panel in a closed shadow root.)
import type { PageReport } from "../page-inject/report";

export type View = { show(report: PageReport): void; hide(): void; destroy(): void };

export function createView(): View {
  return {
    show(report) {
      if (__DEV__) console.info("[page] report", report);
    },
    hide() {},
    destroy() {}
  };
}
