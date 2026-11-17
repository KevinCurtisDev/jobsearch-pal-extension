// Per-tab drafts in chrome.storage.session (SPEC §3 F4, ADR-017). Session storage stays at its default
// access level (TRUSTED_CONTEXTS): content scripts can't read it, so there is no setAccessLevel call.
// Nothing about a draft is kept in worker globals (the worker can stop at any time).
import { defineKey, read, remove, write, type Key } from "../storage/store";
import { parseTabDraft, type TabDraft } from "./report";

export function draftKey(tabId: number): Key<TabDraft | null> {
  return defineKey<TabDraft | null>("session", `draft.${tabId}`, (v) => parseTabDraft(v), null);
}

export async function saveTabDraft(tabId: number, entry: TabDraft): Promise<void> {
  await write(draftKey(tabId), entry);
}

export function tabDraft(tabId: number): Promise<TabDraft | null> {
  return read(draftKey(tabId));
}

export function clearTabDraft(tabId: number): Promise<void> {
  return remove(draftKey(tabId));
}
