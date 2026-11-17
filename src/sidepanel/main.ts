// Side panel (SPEC §3 F1, F4, F5, F6, F7, F8; ADR-012, ADR-017): the current tab's draft as a review form, saved
// through SAVE_JOB, and the saved jobs list, read from Dexie directly. DOM is built with createElement +
// textContent only; styles come from token variables (dist/tokens.css, src/ui/tokens.css).
import { BRAND_NAME } from "../core/brand";
import type { JobDraft } from "../core/model";
import { draftKey, tabDraft } from "../page-inject/report-store";
import type { TabDraft } from "../page-inject/report";
import { SAVE_JOB, SaveJobReplySchema, send } from "../shared/messages";
import { openDb } from "../storage/db";
import { listJobs, type JobList } from "../storage/jobs";
import { watch } from "../storage/store";
import { renderBackup } from "./backup";
import { el } from "./dom";
import { renderList } from "./list";
import { renderNoDraft, renderReview } from "./review";

const db = openDb();

async function loadList(): Promise<JobList | null> {
  try {
    return await listJobs(db);
  } catch {
    return null;
  }
}

async function saveDraft(draft: JobDraft): Promise<string | null> {
  const r = await send<unknown>({ type: SAVE_JOB, v: 1, draft });
  if (!r.ok || !SaveJobReplySchema.safeParse(r.data).success) return "The job wasn't saved. Try again.";
  await refreshList();
  return null;
}

let listSlot: HTMLElement;
let reviewSlot: HTMLElement;

async function refreshList(): Promise<void> {
  listSlot.replaceChildren(renderList(await loadList()));
}

/** The review area keeps the user's edits until the tab or its draft changes. */
let shown: { tabId: number | undefined; draftId: string | undefined } | undefined;
function showDraft(tabId: number | undefined, entry: TabDraft | null): void {
  const draftId = entry?.draft.id;
  if (shown && shown.tabId === tabId && shown.draftId === draftId) return;
  shown = { tabId, draftId };
  reviewSlot.replaceChildren(entry ? renderReview(entry, { save: saveDraft, now: () => new Date().toISOString() }) : renderNoDraft());
}

let stopWatch: (() => void) | undefined;
async function followTab(tabId: number | undefined): Promise<void> {
  stopWatch?.();
  stopWatch = undefined;
  if (tabId === undefined) return showDraft(undefined, null);
  stopWatch = watch(draftKey(tabId), (entry) => showDraft(tabId, entry));
  showDraft(tabId, await tabDraft(tabId));
}

async function activeTabId(): Promise<number | undefined> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
  } catch {
    return undefined;
  }
}

export function renderPanel(root: HTMLElement): void {
  const header = el("header", "panel-header");
  header.append(el("h1", "panel-title", BRAND_NAME));
  reviewSlot = el("div", "slot");
  listSlot = el("div", "slot");
  const backupSlot = el("div", "slot");
  backupSlot.append(renderBackup({ db, now: () => new Date().toISOString(), onImported: refreshList }));
  const main = el("main", "panel");
  main.append(header, reviewSlot, listSlot, backupSlot);
  root.replaceChildren(main);
}

document.title = BRAND_NAME;
renderPanel(document.getElementById("app") ?? document.body);
void refreshList();
void activeTabId().then(followTab);
chrome.tabs.onActivated.addListener(() => void activeTabId().then(followTab));
