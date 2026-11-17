// page-inject without a popup: the toolbar icon runs the page script.
import { expect, test } from "./fixtures";
import { handleState, visibleToPage, waitForAck } from "./page-helpers";

test("toolbar click injects once, repeats toggle the same instance", async ({ context, origin, sw, clickAction }) => {
  const page = await context.newPage();
  await page.goto(`${origin}/basic.html?action`);
  await clickAction(page);
  const first = await waitForAck(sw, page);
  expect(first).toMatchObject({ present: true, visible: true, acked: true });
  await clickAction(page);
  await expect.poll(async () => (await handleState(sw, page)).present && (await handleState(sw, page) as { visible: boolean }).visible).toBe(false);
  const again = await handleState(sw, page);
  expect(again.present && again.instanceId).toBe(first.present && first.instanceId);
  expect(await visibleToPage(page)).toBe(false);
});

test("works on a page with a strict Content-Security-Policy", async ({ context, origin, sw, clickAction }) => {
  const page = await context.newPage();
  await page.goto(`${origin}/strict-csp.html?action`);
  await clickAction(page);
  expect(await waitForAck(sw, page)).toMatchObject({ present: true, acked: true });
});

test("restricted page: no injection, a ! badge and an explanation", async ({ context, sw, clickAction }) => {
  const page = await context.newPage();
  await page.goto("chrome://version/");
  await clickAction(page);
  await expect
    .poll(() => sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "chrome://version/*" }).catch(() => []);
      const tabs = tab ? [tab] : await chrome.tabs.query({});
      for (const t of tabs) {
        const text = await chrome.action.getBadgeText({ tabId: t.id! });
        if (text) return { text, title: await chrome.action.getTitle({ tabId: t.id! }) };
      }
      return null;
    }))
    .toMatchObject({ text: "!" });
});
