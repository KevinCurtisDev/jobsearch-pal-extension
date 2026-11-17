// Background service worker: wiring only. Keep logic in small, tested modules.
// Listeners must be registered synchronously at the top level so Chrome can wake the worker for them.
import { on, startRouter } from "./router";
import { isPing } from "../shared/messages";
import "./modules"; // generated: background parts of the selected factory modules

on("ping", isPing, () => ({ version: chrome.runtime.getManifest().version }));

startRouter();

if (__DEV__) console.info("[bg] service worker started");
