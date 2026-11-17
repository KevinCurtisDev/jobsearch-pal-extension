// Background service worker: wiring only. Keep logic in small, tested modules.
// Listeners must be registered synchronously at the top level so Chrome can wake the worker for them.
import { on, startRouter } from "./router";
import { isPingMessage } from "../shared/zod-guard";
import { getMeta, openDb, putMeta } from "../storage/db";
import "./modules"; // generated: background parts of the selected factory modules

on("ping", isPingMessage, () => ({ version: chrome.runtime.getManifest().version }));

startRouter();

// Test hook for e2e (tests/e2e/db.spec.ts): a meta round-trip in the worker. Not reachable by messages.
(globalThis as Record<string, unknown>).__jspDb = { openDb, getMeta, putMeta };

if (__DEV__) console.info("[bg] service worker started");
