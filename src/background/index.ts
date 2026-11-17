// Background service worker: wiring only. Keep logic in small, tested modules.
// Listeners must be registered synchronously at the top level so Chrome can wake the worker for them.
import { on, startRouter } from "./router";
import { isPingMessage } from "../shared/zod-guard";
import { getMeta, openDb, putMeta, type Db } from "../storage/db";
import { listJobs, saveJob } from "../storage/jobs";
import { registerSaveJob, workerSaveDeps } from "./save";
import "./modules"; // generated: background parts of the selected factory modules

on("ping", isPingMessage, () => ({ version: chrome.runtime.getManifest().version }));

// One Dexie handle per worker life, opened on first use (the worker keeps no other state).
let db: Db | undefined;
registerSaveJob({ db: () => (db ??= openDb()), save: workerSaveDeps, runtimeId: () => chrome.runtime.id, extOrigin: () => chrome.runtime.getURL("") });

startRouter();

// Test hook for e2e (tests/e2e/db.spec.ts): storage calls in the worker. Not reachable by messages.
(globalThis as Record<string, unknown>).__jspDb = { openDb, getMeta, putMeta, listJobs, saveJob: (d: Parameters<typeof saveJob>[0], draft: unknown) => saveJob(d, draft, workerSaveDeps) };

if (__DEV__) console.info("[bg] service worker started");
