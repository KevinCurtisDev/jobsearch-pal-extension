// Capture on the toolbar click (SPEC §3 F2, F3; T1.5): CAPTURE_JOB to the page script, drafts per tab
// in chrome.storage.session, URL-only drafts on X3 sites with nothing injected.
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { handleState, sessionDraft, tabIdOf, visibleToPage, waitForDraft } from "./page-helpers";

/** Serves a local fixture at an https URL (Playwright answers the request; nothing leaves the machine). */
async function serveAt(page: Page, url: string, body: string): Promise<void> {
  await page.route(url, (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body }));
  await page.goto(url);
}

test("JSON-LD page: a full draft, the page unchanged, the handle hidden from page scripts", async ({ context, origin, sw, clickAction }) => {
  const page = await context.newPage();
  await page.goto(`${origin}/jsonld.html?full`);
  const before = await page.content();
  await clickAction(page);
  const entry = await waitForDraft(sw, page);
  expect(entry.mode).toBe("page");
  expect(entry.draft.title).toMatchObject({ value: "Senior Widget Engineer", source: "jsonld" });
  expect(entry.draft.company).toMatchObject({ value: "Example Widgets Ltd", source: "jsonld" });
  expect(entry.draft.pay?.value).toEqual({ currency: "GBP", period: "year", minMinor: 5_500_000, maxMinor: 6_500_050 });
  expect(entry.draft.url).toMatchObject({ value: `${origin}/jsonld.html?full`, source: "jsonld" });
  expect(await page.content()).toBe(before);
  expect(await visibleToPage(page)).toBe(false);

  // A repeat click captures again without a second injection.
  const first = await handleState(sw, page);
  await clickAction(page);
  const again = await waitForDraft(sw, page, entry.draft.id);
  expect(again.mode).toBe("page");
  expect(await handleState(sw, page)).toEqual(first);
});

test("malformed JSON-LD: a manual draft from URL and title, never an error", async ({ context, origin, sw, clickAction }) => {
  const page = await context.newPage();
  await page.goto(`${origin}/jsonld-malformed.html?manual`);
  await clickAction(page);
  const entry = await waitForDraft(sw, page);
  expect(entry.mode).toBe("page");
  expect(entry.draft.title).toMatchObject({ value: "Gadget Tester - Sample Gadgets", source: "manual" });
  expect(entry.draft.company).toBeUndefined();
});

test("Greenhouse board: the adapter fills the draft", async ({ context, sw, clickAction }) => {
  const page = await context.newPage();
  await serveAt(page, "https://job-boards.greenhouse.io/sampleorchard/jobs/1", readFileSync("tests/e2e/pages/greenhouse.html", "utf8"));
  await clickAction(page);
  const entry = await waitForDraft(sw, page);
  expect(entry.mode).toBe("page");
  expect(entry.draft.title).toMatchObject({ value: "Data Gardener", source: "adapter" });
  expect(entry.draft.company).toMatchObject({ value: "Sample Orchard Co", source: "adapter" });
  expect(entry.draft.location).toMatchObject({ value: "Exampleton, Nowhere", source: "adapter" });
});

test("X3 site: URL-only draft, nothing injected, no error badge", async ({ context, sw, clickAction }) => {
  const page = await context.newPage();
  const body = '<!doctype html><title>Data Gardener | LinkedIn</title><script type="application/ld+json">{"@type":"JobPosting","title":"Should not be read"}</script><h1>x</h1>';
  await serveAt(page, "https://www.linkedin.com/jobs/view/123", body);
  await clickAction(page);
  const entry = await waitForDraft(sw, page);
  expect(entry).toMatchObject({ mode: "url-only", reason: "x3" });
  expect(entry.draft.url).toMatchObject({ value: "https://www.linkedin.com/jobs/view/123", source: "manual" });
  expect(entry.draft.title).toMatchObject({ value: "Data Gardener | LinkedIn", source: "manual" });
  expect(Object.keys(entry.draft).sort()).toEqual(["capturedAt", "id", "title", "url"]);
  expect(await handleState(sw, page)).toEqual({ present: false });
  const tabId = await tabIdOf(sw, page);
  expect(await sw.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId)).toBe("");
});

test("session drafts: content scripts can't read them, and closing the tab removes the draft", async ({ context, origin, sw, clickAction }) => {
  const page = await context.newPage();
  await page.goto(`${origin}/jsonld.html?session`);
  await clickAction(page);
  await waitForDraft(sw, page);
  const tabId = await tabIdOf(sw, page);
  const fromContentScript = await sw.evaluate(async (id) => {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: id },
      func: async () => {
        try {
          const got = await chrome.storage.session.get(null);
          return Object.keys(got).length > 0 ? "read" : "empty";
        } catch (e) {
          return `denied: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
    });
    return res!.result as string;
  }, tabId);
  expect(fromContentScript).toMatch(/^denied/);
  await page.close();
  await expect.poll(() => sessionDraft(sw, tabId)).toBeNull();
});

test("works on a page with a strict Content-Security-Policy", async ({ context, origin, sw, clickAction }) => {
  const page = await context.newPage();
  await page.goto(`${origin}/strict-csp.html?action`);
  await clickAction(page);
  expect((await waitForDraft(sw, page)).mode).toBe("page");
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
