// Background handlers for page injection.
// - Toolbar click (only fires when there is no popup) opens the side panel, then activates the current tab
//   (ADR-012). openPanelOnActionClick stays false, or Chrome would stop firing action.onClicked.
// - "inject:run" from an extension page (the popup's Run on this page button) activates a tab.
// - "page:report" from the injected script's top frame is validated and handed to report-store.
// - "report:last" returns the last saved report (null unless the storage module is selected).
import { on } from "../background/router";
import { isExtensionPage } from "../shared/messages";
import { isIntInRange, isRecord } from "../shared/validate";
import { activateTab } from "./activate";
import { explain } from "./reasons";
import { parseReport } from "./report";
import { lastReport, saveReport } from "./report-store";

export type InjectRun = { type: "inject:run"; tabId: number };
export type PageReportMsg = { type: "page:report"; report: unknown };
export type ReportLast = { type: "report:last" };

const isInjectRun = (m: unknown): m is InjectRun => isRecord(m) && m.type === "inject:run" && isIntInRange(m.tabId, 0, Number.MAX_SAFE_INTEGER);
const isPageReport = (m: unknown): m is PageReportMsg => isRecord(m) && m.type === "page:report" && "report" in m;
const isReportLast = (m: unknown): m is ReportLast => isRecord(m) && m.type === "report:last";
const extOrigin = () => chrome.runtime.getURL("");

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((e: unknown) => console.warn("sidePanel.setPanelBehavior failed:", String(e)));

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  const tabId = tab.id;
  // open() needs the user gesture, so it runs first with no await before it. Headless Chromium may refuse it.
  chrome.sidePanel.open({ tabId }).catch((e: unknown) => console.warn("sidePanel.open failed:", String(e)));
  void activateTab(tabId).then(async (r) => {
    if (r.kind === "unavailable") {
      await chrome.action.setBadgeText({ tabId, text: "!" }).catch(() => {});
      await chrome.action.setTitle({ tabId, title: explain(r.reason) }).catch(() => {});
    } else if (r.kind !== "gone") {
      await chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
    }
  });
});

on("inject:run", isInjectRun, (m, sender) => {
  if (!isExtensionPage(sender, chrome.runtime.id, extOrigin())) throw new Error("not allowed");
  return activateTab(m.tabId);
});

on("page:report", isPageReport, async (m, sender) => {
  if (sender.tab?.id === undefined || sender.frameId !== 0) throw new Error("top frame only");
  const report = parseReport(m.report);
  if (!report) throw new Error("invalid report");
  return { stored: await saveReport(report) };
});

on("report:last", isReportLast, (_m, sender) => {
  if (!isExtensionPage(sender, chrome.runtime.id, extOrigin())) throw new Error("not allowed");
  return lastReport();
});
