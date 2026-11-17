// Playwright fixtures for testing the built extension (dist/) in real Chromium.
//   context      persistent Chromium with only this extension loaded
//   sw           the extension's service worker (evaluate chrome.* calls in it)
//   origin       a local static server for tests/e2e/pages/ (headers from <page>.headers.json)
//   clickAction  clicks the toolbar icon for a page's tab (CDP Extensions.triggerAction: grants activeTab,
//                fires action.onClicked, or opens the real popup when there is one)
//   openPopup    clicks the icon and returns a driver for the real popup (via CDP, as Playwright
//                doesn't expose extension popups as pages)
//   net          offline guard: aborts and records every request that is not to `origin` or
//                chrome-extension:// (pages and service workers, via context.route)
import { test as base, chromium, type BrowserContext, type CDPSession, type Page, type Worker } from "@playwright/test";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

const pagesDir = path.resolve("tests/e2e/pages");

export type Popup = {
  /** Evaluates a JavaScript expression in the popup and returns its JSON value. */
  eval<T = unknown>(expression: string): Promise<T>;
  click(selector: string): Promise<void>;
  text(selector: string): Promise<string>;
  /** Waits until `expression` is truthy in the popup. */
  waitFor(expression: string, timeoutMs?: number): Promise<void>;
  close(): Promise<void>;
};

type Fixtures = {
  context: BrowserContext;
  sw: Worker;
  extensionId: string;
  cdp: CDPSession;
  clickAction: (page: Page) => Promise<void>;
  openPopup: (page: Page) => Promise<Popup>;
  manifest: () => Promise<chrome.runtime.Manifest>;
  net: NetLog;
};

export type NetLog = {
  /** Requests that were aborted because they left the machine (URL, and "sw" if from a service worker). */
  external: { url: string; from: "page" | "sw" }[];
  clear(): void;
};

export const test = base.extend<Fixtures, { origin: string }>({
  origin: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const server = http.createServer((req, res) => {
        const rel = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname).replace(/^\/+/, "");
        const file = path.resolve(pagesDir, rel || "basic.html");
        if (!file.startsWith(pagesDir + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
          res.writeHead(404).end("not found");
          return;
        }
        const sidecar = `${file}.headers.json`;
        const extra = existsSync(sidecar) ? (JSON.parse(readFileSync(sidecar, "utf8")) as Record<string, string>) : {};
        res.writeHead(200, { "content-type": file.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream", ...extra });
        createReadStream(file).pipe(res);
      });
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      await use(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
      await new Promise<void>((r) => server.close(() => r()));
    },
    { scope: "worker" }
  ],

  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await launchExtension();
    await use(context);
    await context.close();
  },

  sw: async ({ context }, use) => use(await readyWorker(context)),

  extensionId: async ({ sw }, use) => use(new URL(sw.url()).host),

  cdp: async ({ context }, use) => {
    const browser = context.browser();
    if (!browser) throw new Error("persistent context has no Browser handle");
    const cdp = await browser.newBrowserCDPSession();
    await use(cdp);
    await cdp.detach().catch(() => {});
  },

  net: async ({ context, origin }, use) => {
    const external: NetLog["external"] = [];
    await context.route("**/*", async (route) => {
      const req = route.request();
      const url = req.url();
      if (url.startsWith(`${origin}/`) || url.startsWith("chrome-extension://")) return route.continue();
      external.push({ url, from: req.serviceWorker() ? "sw" : "page" });
      return route.abort("internetdisconnected");
    });
    await use({ external, clear: () => void external.splice(0) });
    await context.unrouteAll({ behavior: "ignoreErrors" });
  },

  manifest: async ({ sw }, use) => use(() => sw.evaluate(() => chrome.runtime.getManifest())),

  clickAction: async ({ cdp, extensionId }, use) => {
    await use(async (page) => {
      const { targetInfos } = (await cdp.send("Target.getTargets", { filter: [{ type: "tab" }] } as never)) as unknown as { targetInfos: { targetId: string; url: string }[] };
      const matches = targetInfos.filter((t) => t.url === page.url());
      if (matches.length !== 1) throw new Error(`expected one tab at ${page.url()}, found ${matches.length}; use a unique URL per test`);
      await cdp.send("Extensions.triggerAction" as never, { id: extensionId, targetId: matches[0]!.targetId } as never);
    });
  },

  openPopup: async ({ cdp, extensionId, clickAction }, use) => {
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    const pageTargets = async () => ((await cdp.send("Target.getTargets", { filter: [{ type: "page" }] } as never)) as unknown as { targetInfos: { targetId: string; url: string }[] }).targetInfos;
    await use(async (page) => {
      const before = new Set((await pageTargets()).filter((t) => t.url === popupUrl).map((t) => t.targetId));
      await page.bringToFront();
      await clickAction(page);
      let targetId: string | undefined;
      for (let i = 0; i < 100 && !targetId; i++) {
        targetId = (await pageTargets()).find((t) => t.url === popupUrl && !before.has(t.targetId))?.targetId;
        if (!targetId) await new Promise((r) => setTimeout(r, 50));
      }
      if (!targetId) throw new Error("the popup didn't open");
      return driver(cdp, targetId);
    });
  }
});

/** Launches persistent Chromium with only dist/ loaded. `extraArgs` go on the command line. */
export async function launchExtension(extraArgs: string[] = []): Promise<BrowserContext> {
  const ext = path.resolve("dist");
  if (!existsSync(path.join(ext, "manifest.json"))) throw new Error("dist/ is missing: run npm run build (npm run test:e2e does this)");
  return chromium.launchPersistentContext("", {
    channel: "chromium",
    ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
    headless: process.env.HEADLESS !== "0",
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, ...extraArgs]
  });
}

/** Waits for the extension's service worker and until it has registered its listeners. */
export async function readyWorker(context: BrowserContext): Promise<Worker> {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker");
  // The worker object appears before its script has finished running; wait until the background has
  // registered its listeners (the core router always listens to runtime.onMessage), or early toolbar
  // clicks can be lost.
  for (let i = 0; i < 200; i++) {
    if (await sw.evaluate(() => chrome.runtime.onMessage.hasListeners()).catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  return sw;
}

/** Drives a page target through the browser CDP session (non-flattened attach). */
async function driver(cdp: CDPSession, targetId: string): Promise<Popup> {
  const { sessionId } = (await cdp.send("Target.attachToTarget", { targetId, flatten: false } as never)) as unknown as { sessionId: string };
  let seq = 0;
  const pending = new Map<number, (m: { result?: { result?: { value?: unknown }; exceptionDetails?: { text: string } }; error?: { message: string } }) => void>();
  cdp.on("Target.receivedMessageFromTarget" as never, ((e: { sessionId: string; message: string }) => {
    if (e.sessionId !== sessionId) return;
    const m = JSON.parse(e.message) as { id?: number };
    if (m.id !== undefined && pending.has(m.id)) {
      pending.get(m.id)!(m as never);
      pending.delete(m.id);
    }
  }) as never);
  const evaluate = async <T>(expression: string): Promise<T> => {
    const id = ++seq;
    const reply = new Promise<Parameters<NonNullable<ReturnType<typeof pending.get>>>[0]>((r) => pending.set(id, r));
    await cdp.send("Target.sendMessageToTarget" as never, { sessionId, message: JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }) } as never);
    const m = await reply;
    if (m.error) throw new Error(m.error.message);
    if (m.result?.exceptionDetails) throw new Error(`popup: ${m.result.exceptionDetails.text}`);
    return m.result?.result?.value as T;
  };
  const waitFor = async (expression: string, timeoutMs = 10_000) => {
    const end = Date.now() + timeoutMs;
    // The popup may still be loading: treat errors (e.g. an element not there yet) as "not yet".
    while (!(await evaluate<boolean>(`(() => { try { return !!(${expression}); } catch { return false; } })()`))) {
      if (Date.now() > end) throw new Error(`timed out waiting for ${expression}`);
      await new Promise((r) => setTimeout(r, 50));
    }
  };
  return {
    eval: evaluate,
    waitFor,
    click: async (selector) => {
      await waitFor(`document.querySelector(${JSON.stringify(selector)})`);
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    },
    text: (selector) => evaluate<string>(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ""`),
    close: async () => {
      await evaluate("window.close()").catch(() => {});
    }
  };
}

export const expect = test.expect;
