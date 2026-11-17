// M1 slice acceptance (source 17 §10; docs/TASKS.md M1 exit criteria), end to end: a real toolbar capture,
// the panel review form, Save, and the saved list. Where each of the six acceptance tests is proved:
//   1. three fixture pages save ............................ this file
//   2. worker killed mid-save loses nothing ................ db.spec.ts ("killing the browser mid-save …")
//   3. export then import into an empty profile is equal ... backup.spec.ts
//   4. restricted-site tab saves from URL, title, paste .... this file
//   5. axe: no serious issues on the side panel ............ a11y.spec.ts
//   6. zero network calls .................................. offline.spec.ts
import { readFileSync } from "node:fs";
import type { BrowserContext, Page, Worker } from "@playwright/test";
import { BRAND_NAME } from "../../src/core/brand";
import { expect, test } from "./fixtures";
import { waitForDraft } from "./page-helpers";

/** Serves a local fixture at an https URL (Playwright answers the request; nothing leaves the machine). */
async function serveAt(page: Page, url: string, body: string): Promise<void> {
  await page.route(url, (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body }));
  await page.goto(url);
}

/** Opens the panel in a tab and hands it the captured page's draft, as the worker does for the active tab. */
async function reviewIn(context: BrowserContext, extensionId: string, entry: unknown): Promise<Page> {
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 320, height: 900 });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(panel.getByRole("heading", { level: 1 })).toHaveText(BRAND_NAME);
  const tabId = await panel.evaluate(async () => (await chrome.tabs.getCurrent())!.id!);
  await panel.evaluate(([key, value]) => chrome.storage.session.set({ [key as string]: value }), [`draft.${tabId}`, entry] as const);
  return panel;
}

type Stored = { title: { value: string; source: string }; url: { value: string }; company?: { value: string }; description?: { value: string; source: string } };
const storedJobs = (sw: Worker) =>
  sw.evaluate(async () => {
    const h = (globalThis as unknown as { __jspDb: { openDb(): unknown; listJobs(db: unknown): Promise<{ items: { job: unknown; application: { status: string } | null }[] }> } }).__jspDb;
    return (await h.listJobs(h.openDb())).items;
  }) as Promise<{ job: Stored; application: { status: string } | null }[]>;

test("acceptance 1: JSON-LD, Greenhouse and a page without data are captured, reviewed and saved", async ({ context, origin, extensionId, sw, clickAction }) => {
  const pages: { open: (p: Page) => Promise<unknown>; title: string; company?: string }[] = [
    { open: (p) => p.goto(`${origin}/jsonld.html?slice`), title: "Senior Widget Engineer", company: "Example Widgets Ltd" },
    { open: (p) => serveAt(p, "https://job-boards.greenhouse.io/sampleorchard/jobs/1", readFileSync("tests/e2e/pages/greenhouse.html", "utf8")), title: "Data Gardener", company: "Sample Orchard Co" },
    { open: (p) => p.goto(`${origin}/jsonld-malformed.html?slice`), title: "Gadget Tester - Sample Gadgets" },
  ];
  for (const [i, spec] of pages.entries()) {
    const job = await context.newPage();
    await spec.open(job);
    await clickAction(job);
    const panel = await reviewIn(context, extensionId, await waitForDraft(sw, job));
    await expect(panel.getByLabel("Job title (required)")).toHaveValue(spec.title);
    await panel.getByRole("button", { name: "Save job" }).click();
    await expect(panel.getByRole("status")).toHaveText("Saved. It's in your list below.");
    await expect(panel.getByRole("listitem")).toHaveCount(i + 1);
    await expect(panel.getByRole("listitem").first().getByRole("link")).toHaveText(spec.title);
    await panel.close();
    await job.close();
  }
  const items = await storedJobs(sw);
  expect(items.map((x) => x.job.title.value).sort()).toEqual(pages.map((p) => p.title).sort());
  for (const p of pages) expect(items.find((x) => x.job.title.value === p.title)?.job.company?.value).toBe(p.company);
  expect(items.every((x) => x.application?.status === "saved")).toBe(true);
});

test("acceptance 4: a LinkedIn tab saves from its URL, title and pasted text only", async ({ context, extensionId, sw, clickAction }) => {
  const job = await context.newPage();
  const url = "https://www.linkedin.com/jobs/view/4242";
  await serveAt(job, url, '<!doctype html><title>Data Gardener | LinkedIn</title><script type="application/ld+json">{"@type":"JobPosting","title":"Should not be read"}</script><h1>x</h1>');
  await clickAction(job);
  const entry = await waitForDraft(sw, job);
  expect(entry).toMatchObject({ mode: "url-only", reason: "x3" });

  const panel = await reviewIn(context, extensionId, entry);
  await expect(panel.getByLabel("Job title (required)")).toHaveValue("Data Gardener | LinkedIn");
  await panel.getByLabel("Job title (required)").fill("Data Gardener");
  await panel.getByLabel("Job description").focus();
  await panel.keyboard.insertText("Water the data.");
  await panel.getByRole("button", { name: "Save job" }).click();
  await expect(panel.getByRole("listitem").getByRole("link")).toHaveText("Data Gardener");

  const [saved] = await storedJobs(sw);
  expect(saved!.job.url.value).toBe(url);
  expect(saved!.job.title).toMatchObject({ value: "Data Gardener", source: "manual" });
  expect(saved!.job.description).toMatchObject({ value: "Water the data.", source: "manual" });
  expect(JSON.stringify(saved)).not.toContain("Should not be read");
});
