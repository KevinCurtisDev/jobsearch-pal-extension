// Background service worker: wiring only. Keep logic in small, tested modules.
// Listeners must be registered synchronously at the top level so Chrome can wake the worker for them.
import { on, startRouter } from "./router";
import { isPingMessage } from "../shared/zod-guard";
import { getMeta, openDb, putMeta } from "../storage/db";
import { listJobs, saveJob, type SaveDeps } from "../storage/jobs";
import { createUlid } from "../core/ulid";
import "./modules"; // generated: background parts of the selected factory modules

on("ping", isPingMessage, () => ({ version: chrome.runtime.getManifest().version }));

startRouter();

/** Ids and clock for saves (SAVE_JOB arrives with the side panel, T1.6). */
const saveDeps: SaveDeps = { newId: createUlid({ random: (b) => { crypto.getRandomValues(b as Uint8Array<ArrayBuffer>); return b; } }), now: () => new Date().toISOString() };

// Test hook for e2e (tests/e2e/db.spec.ts): storage calls in the worker. Not reachable by messages.
(globalThis as Record<string, unknown>).__jspDb = { openDb, getMeta, putMeta, listJobs, saveJob: (db: Parameters<typeof saveJob>[0], draft: unknown) => saveJob(db, draft, saveDeps) };

if (__DEV__) console.info("[bg] service worker started");
