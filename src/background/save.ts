// SAVE_JOB handler (SPEC §3 F4, ADR-017): the only message that writes saved jobs. The router checks the
// sender is this extension and the Zod validator checks the message; this handler also refuses anything
// that isn't one of the extension's own pages (an injected page script can't save). Replies `{ jobId }` only.
import { createUlid } from "../core/ulid";
import { isExtensionPage, SAVE_JOB, SaveJobSchema, type SaveJob, type SaveJobReply } from "../shared/messages";
import { guard } from "../shared/zod-guard";
import type { Db } from "../storage/db";
import { saveJob, type SaveDeps } from "../storage/jobs";
import { on } from "./router";

export const isSaveJob = guard(SaveJobSchema);

/** Ids and clock for saves in the worker. */
export const workerSaveDeps: SaveDeps = {
  newId: createUlid({ random: (b) => { crypto.getRandomValues(b as Uint8Array<ArrayBuffer>); return b; } }),
  now: () => new Date().toISOString(),
};

export type SaveHandlerDeps = { db: () => Db; save: SaveDeps; runtimeId: () => string; extOrigin: () => string };

export function handleSaveJob(msg: SaveJob, sender: chrome.runtime.MessageSender, deps: SaveHandlerDeps): Promise<SaveJobReply> {
  if (!isExtensionPage(sender, deps.runtimeId(), deps.extOrigin())) return Promise.reject(new Error("forbidden"));
  return saveJob(deps.db(), msg.draft, deps.save).then((r) => ({ jobId: r.jobId }));
}

export function registerSaveJob(deps: SaveHandlerDeps): void {
  on<SaveJob>(SAVE_JOB, isSaveJob, (m, sender) => handleSaveJob(m, sender, deps));
}
