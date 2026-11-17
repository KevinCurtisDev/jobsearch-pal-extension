// Spike S13 (ADR-013): does a button click inside the side panel give the extension an activeTab grant
// for the current tab, with and without openPanelOnActionClick? Test-only: no production code changes.
//
// Method: open the real side panel with a toolbar click (CDP Extensions.triggerAction), revoke the
// click's grant by navigating the tab cross-origin (127.0.0.1 → localhost), then dispatch a trusted
// mouse click (CDP Input.dispatchMouseEvent) on a probe button added to the panel. The button's
// handler calls chrome.scripting.executeScript on the active tab. Controls prove that the toolbar
// click grants access, that the navigation revokes it, and that the probe sees user activation.
import type { CDPSession, Page, Worker } from "@playwright/test";
import { expect, test } from "./fixtures";

type Probe = { activation: boolean; ok: boolean; result?: string; error?: string };

/** A non-flattened CDP channel to one target (Playwright doesn't expose side panels as pages). */
async function attach(cdp: CDPSession, targetId: string) {
  const { sessionId } = (await cdp.send("Target.attachToTarget", { targetId, flatten: false } as never)) as unknown as { sessionId: string };
  let seq = 0;
  const pending = new Map<number, (m: { result?: unknown; error?: { message: string } }) => void>();
  cdp.on("Target.receivedMessageFromTarget" as never, ((e: { sessionId: string; message: string }) => {
    if (e.sessionId !== sessionId) return;
    const m = JSON.parse(e.message) as { id?: number };
    if (m.id !== undefined) pending.get(m.id)?.(m as never);
  }) as never);
  const call = async <T>(method: string, params: object): Promise<T> => {
    const id = ++seq;
    const reply = new Promise<{ result?: unknown; error?: { message: string } }>((r) => pending.set(id, r));
    await cdp.send("Target.sendMessageToTarget" as never, { sessionId, message: JSON.stringify({ id, method, params }) } as never);
    const m = await reply;
    pending.delete(id);
    if (m.error) throw new Error(`${method}: ${m.error.message}`);
    return m.result as T;
  };
  const evaluate = async <T>(expression: string): Promise<T> => {
    const r = await call<{ result?: { value?: unknown }; exceptionDetails?: { text: string } }>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`panel: ${r.exceptionDetails.text}`);
    return r.result?.value as T;
  };
  return { call, evaluate };
}

async function panelTargetId(cdp: CDPSession, extensionId: string): Promise<string> {
  const url = `chrome-extension://${extensionId}/sidepanel.html`;
  for (let i = 0; i < 100; i++) {
    const { targetInfos } = (await cdp.send("Target.getTargets", { filter: [{ type: "page" }] } as never)) as unknown as { targetInfos: { targetId: string; url: string }[] };
    const t = targetInfos.find((x) => x.url === url);
    if (t) return t.targetId;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("the side panel didn't open");
}

/** Adds a probe button to the panel (test DOM only) whose click handler tries to script the active tab. */
const INSTALL_PROBE = `(() => {
  const b = document.createElement("button");
  b.id = "s13-probe";
  b.textContent = "S13 probe";
  b.style.cssText = "position:fixed;left:10px;top:10px;width:120px;height:44px;z-index:99999";
  b.addEventListener("click", async () => {
    const activation = navigator.userActivation.isActive;
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => location.origin });
      window.__s13 = { activation, ok: true, result: String(r.result) };
    } catch (e) {
      window.__s13 = { activation, ok: false, error: String(e && e.message || e).slice(0, 200) };
    }
  });
  document.body.append(b);
  return true;
})()`;

/** A trusted click (real input event with user activation) on the probe; returns what the handler saw. */
async function trustedProbeClick(panel: Awaited<ReturnType<typeof attach>>): Promise<Probe> {
  await panel.evaluate("delete window.__s13, true");
  for (const type of ["mousePressed", "mouseReleased"]) await panel.call("Input.dispatchMouseEvent", { type, x: 40, y: 30, button: "left", clickCount: 1 });
  for (let i = 0; i < 100; i++) {
    const r = await panel.evaluate<Probe | null>("window.__s13 ?? null");
    if (r) return r;
    await new Promise((res) => setTimeout(res, 50));
  }
  throw new Error("probe click had no effect");
}

/** Scripting from the worker, with no new user gesture: succeeds only while a grant exists. */
async function workerCanScript(sw: Worker, url: string): Promise<boolean> {
  return sw.evaluate(async (u) => {
    const [tab] = await chrome.tabs.query({ url: u });
    if (!tab?.id) return false;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => 1 });
      return true;
    } catch {
      return false;
    }
  }, url);
}

async function scenario(openPanelOnActionClick: boolean, { context, origin, sw, cdp, extensionId, clickAction }: { context: import("@playwright/test").BrowserContext; origin: string; sw: Worker; cdp: CDPSession; extensionId: string; clickAction: (p: Page) => Promise<void> }) {
  await sw.evaluate((v) => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: v }), openPanelOnActionClick);
  const page = await context.newPage();
  const first = `${origin}/basic.html?s13-${openPanelOnActionClick}`;
  await page.goto(first);
  await page.bringToFront();
  expect(await workerCanScript(sw, first), "control: no grant before any click").toBe(false);

  await clickAction(page);
  const panel = await attach(cdp, await panelTargetId(cdp, extensionId));
  await expect.poll(() => panel.evaluate<boolean>("document.readyState === 'complete'")).toBe(true);
  const afterToolbar = await workerCanScript(sw, first);

  // Cross-origin navigation revokes any activeTab grant.
  const second = `${origin.replace("127.0.0.1", "localhost")}/basic.html?s13-${openPanelOnActionClick}`;
  await page.goto(second);
  await page.bringToFront();
  const afterNavigation = await workerCanScript(sw, second);

  await panel.evaluate(INSTALL_PROBE);
  const probe = await trustedProbeClick(panel);
  const afterPanelClick = await workerCanScript(sw, second);
  const result = { openPanelOnActionClick, afterToolbar, afterNavigation, probe, afterPanelClick };
  console.log("S13", JSON.stringify(result));
  return result;
}

test.describe("spike S13: activeTab from a side panel click", () => {
  test("openPanelOnActionClick false (the shipped setting)", async ({ context, origin, sw, cdp, extensionId, clickAction }) => {
    const r = await scenario(false, { context, origin, sw, cdp, extensionId, clickAction });
    expect(r.afterToolbar, "control: our onClicked capture runs, so the toolbar click grants").toBe(true);
    expect(r.afterNavigation, "control: cross-origin navigation revokes the grant").toBe(false);
    expect(r.probe.activation, "control: the probe click is a trusted user gesture").toBe(true);
    expect(r.probe.ok, `panel click: ${r.probe.error ?? ""}`).toBe(false);
    expect(r.afterPanelClick).toBe(false);
  });

  test("openPanelOnActionClick true", async ({ context, origin, sw, cdp, extensionId, clickAction }) => {
    const r = await scenario(true, { context, origin, sw, cdp, extensionId, clickAction });
    // Observed in Chromium 158 via CDP: when Chrome opens the panel itself, onClicked doesn't fire and
    // the click leaves no activeTab grant the worker can use (manual check in Chrome: docs/QA.md M1).
    expect(r.afterToolbar, "observed: no grant from a panel-opening toolbar click").toBe(false);
    expect(r.afterNavigation, "control: cross-origin navigation revokes the grant").toBe(false);
    expect(r.probe.activation, "control: the probe click is a trusted user gesture").toBe(true);
    expect(r.probe.ok, `panel click: ${r.probe.error ?? ""}`).toBe(false);
    expect(r.afterPanelClick).toBe(false);
  });
});
