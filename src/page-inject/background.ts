// Background handlers for capture (SPEC §3 F2, F3; ADR-012, ADR-017).
// - Toolbar click (only fires when there is no popup) opens the side panel, then captures the current
//   tab and stores the result in chrome.storage.session under the tab's id. openPanelOnActionClick
//   stays false, or Chrome would stop firing action.onClicked.
// - A tab's draft is removed when the tab closes.
// The worker receives no page messages: it asks the page with CAPTURE_JOB and validates the reply.
import { createUlid } from "../core/ulid";
import { activateTab, type ActivationDeps } from "./activate";
import { explain } from "./reasons";
import { clearTabDraft, saveTabDraft } from "./report-store";

const deps: ActivationDeps = {
  newId: createUlid({ random: (b) => { crypto.getRandomValues(b as Uint8Array<ArrayBuffer>); return b; } }),
  now: () => new Date().toISOString()
};

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((e: unknown) => console.warn("sidePanel.setPanelBehavior failed:", String(e)));

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  const tabId = tab.id;
  // open() needs the user gesture, so it runs first with no await before it. Headless Chromium may refuse it.
  chrome.sidePanel.open({ tabId }).catch((e: unknown) => console.warn("sidePanel.open failed:", String(e)));
  void activateTab(tabId, deps).then(async (r) => {
    if (r.kind === "gone") return;
    if (r.kind === "captured") await saveTabDraft(tabId, r.entry).catch((e: unknown) => console.warn("saving the draft failed:", String(e)));
    // A badge only when the page couldn't be read for a reason the user can fix or should know about.
    const reason = r.kind === "unavailable" ? r.reason : r.entry.mode === "url-only" && r.entry.reason !== "x3" ? r.entry.reason : null;
    await chrome.action.setBadgeText({ tabId, text: reason ? "!" : "" }).catch(() => {});
    if (reason) await chrome.action.setTitle({ tabId, title: explain(reason) }).catch(() => {});
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearTabDraft(tabId).catch(() => {});
});
