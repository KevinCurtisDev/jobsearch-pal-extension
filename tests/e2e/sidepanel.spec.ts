// Side panel (SPEC §3 F1, F4, F5, F8; ADR-012, ADR-017). The panel page is opened in a tab at 320 px wide;
// its "current tab" is then that tab, so each test stores a draft under the panel tab's own id, as the
// worker does for a captured page. The real side panel is covered by spike-s13.spec.ts.
import type { Page } from "@playwright/test";
import { BRAND_NAME } from "../../src/core/brand";
import { expect, test } from "./fixtures";
import { waitForDraft } from "./page-helpers";

const AT = "2026-11-17T10:00:00.000Z";
const f = <T>(value: T, source = "manual", confidence = 1) => ({ value, source, confidence, at: AT });

async function openPanel(page: Page, extensionId: string): Promise<number> {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(BRAND_NAME);
  return page.evaluate(async () => (await chrome.tabs.getCurrent())!.id!);
}

async function putDraft(page: Page, tabId: number, entry: unknown): Promise<void> {
  await page.evaluate(([key, value]) => chrome.storage.session.set({ [key as string]: value }), [`draft.${tabId}`, entry] as const);
}

type Listed = { items: { job: Record<string, { value: unknown; source: string }>; application: { status: string } | null }[] };
const listInWorker = (sw: import("@playwright/test").Worker) =>
  sw.evaluate(async () => {
    const h = (globalThis as unknown as { __jspDb: { openDb(): unknown; listJobs(db: unknown): Promise<unknown> } }).__jspDb;
    return h.listJobs(h.openDb());
  }) as Promise<Listed>;

/** Presses Tab until `target` has focus (fails after `max` presses). Returns the number of presses. */
async function tabTo(page: Page, target: import("@playwright/test").Locator, max = 20): Promise<number> {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((n) => n === document.activeElement)) return i;
  }
  throw new Error("never reached the target by Tab");
}

test("the shell shows the brand, an empty list and a hint, styled by token variables", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await openPanel(page, extensionId);
  await expect(page.getByRole("heading", { name: "Save a job" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved jobs" })).toBeVisible();
  await expect(page.getByText("No saved jobs yet")).toBeVisible();
  // --color-ink (#1D1D1F) reaches the page only through the generated tokens.css.
  expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe("rgb(29, 29, 31)");
});

test("a captured page's draft is reviewed and saved by keyboard only, then listed", async ({ context, extensionId, sw, origin, clickAction }) => {
  const job = await context.newPage();
  await job.goto(`${origin}/jsonld.html?panel-flow`);
  await clickAction(job);
  const entry = await waitForDraft(sw, job);

  const page = await context.newPage();
  const tabId = await openPanel(page, extensionId);
  await putDraft(page, tabId, entry);

  // Every input has a visible label; captured values are filled in.
  await expect(page.getByLabel("Job title (required)")).toHaveValue("Senior Widget Engineer");
  await expect(page.getByLabel("Company")).toHaveValue("Example Widgets Ltd");
  await expect(page.getByLabel("Job post address (URL) (required)")).toHaveValue(job.url());
  await expect(page.getByLabel("Location")).toBeVisible();
  await expect(page.getByLabel("Job description")).toBeVisible();

  // 44 px targets at 320 px wide, and nothing wider than the panel.
  const save = page.getByRole("button", { name: "Save job" });
  for (const target of [save, ...(await page.locator("input, textarea").all())]) {
    const box = (await target.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  // Keyboard only: edit the title, Tab through every field to Save, press Enter.
  await tabTo(page, page.getByLabel("Job title (required)"));
  await page.keyboard.press("End");
  await page.keyboard.type(" (remote)");
  expect(await tabTo(page, save)).toBe(5); // company, location, URL, description, then Save
  expect(await save.evaluate((n) => getComputedStyle(n).outlineStyle)).toBe("solid"); // visible focus
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toHaveText("Saved. It's in your list below.");
  const item = page.getByRole("listitem");
  await expect(item).toHaveCount(1);
  await expect(item.getByRole("link")).toHaveText("Senior Widget Engineer (remote)");
  await expect(item).toContainText("Example Widgets Ltd");
  await expect(item).toContainText("Status: Saved");
  await expect(save).toBeFocused(); // focus stays on the button after saving

  // The worker stored it; the edited title is manual, the rest kept its provenance.
  const { items } = await listInWorker(sw);
  expect(items).toHaveLength(1);
  expect(items[0]!.job.title).toMatchObject({ value: "Senior Widget Engineer (remote)", source: "manual" });
  expect(items[0]!.job.company).toMatchObject({ value: "Example Widgets Ltd", source: "jsonld" });
  expect(items[0]!.application?.status).toBe("saved");

  // Saving the same draft again adds nothing (idempotent by draft id).
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Saved. It's in your list below.");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  expect((await listInWorker(sw)).items).toHaveLength(1);
});

test("pasted text completes a URL-only draft", async ({ context, extensionId, sw }) => {
  const page = await context.newPage();
  const tabId = await openPanel(page, extensionId);
  const draft = { id: "01JD0000000000000000000A01", capturedAt: AT, url: f("https://www.linkedin.com/jobs/view/123"), title: f("Data Gardener | LinkedIn", "manual", 0.4) };
  await putDraft(page, tabId, { mode: "url-only", reason: "x3", draft });

  await expect(page.getByText("On LinkedIn, Indeed and Glassdoor only the page address and title are saved.")).toBeVisible();
  await expect(page.getByText("Paste the job description from the page here.")).toBeVisible();
  await page.getByLabel("Job title (required)").fill("Data Gardener");
  await page.getByLabel("Company").fill("Sample Orchard Co");
  await page.getByLabel("Job description").focus();
  await page.keyboard.insertText("Water the data.\n\nPrune the logs.");
  await page.getByRole("button", { name: "Save job" }).click();

  await expect(page.getByRole("listitem").getByRole("link")).toHaveText("Data Gardener");
  const job = (await listInWorker(sw)).items[0]!.job;
  expect(job.description).toMatchObject({ value: "Water the data.\n\nPrune the logs.", source: "manual" });
  expect(job.company).toMatchObject({ value: "Sample Orchard Co", source: "manual" });
  expect(job.url).toMatchObject({ value: "https://www.linkedin.com/jobs/view/123" });
});

test("captured text is shown as text, never as markup", async ({ context, extensionId }) => {
  const page = await context.newPage();
  const tabId = await openPanel(page, extensionId);
  const hostile = `<img src=x onerror="window.__pwned=1">`;
  const draft = { id: "01JD0000000000000000000A02", capturedAt: AT, url: f("https://jobs.example.com/x"), title: f(hostile, "jsonld", 0.9), company: f("<b>Acme</b>", "jsonld", 0.9) };
  await putDraft(page, tabId, { mode: "page", draft });

  await expect(page.getByLabel("Job title (required)")).toHaveValue(hostile);
  await page.getByRole("button", { name: "Save job" }).click();
  await expect(page.getByRole("listitem").getByRole("link")).toHaveText(hostile);
  await expect(page.getByRole("listitem")).toContainText("<b>Acme</b>");
  expect(await page.evaluate(() => ({ img: document.querySelectorAll("img").length, b: document.querySelectorAll("b").length, pwned: "__pwned" in window }))).toEqual({ img: 0, b: 0, pwned: false });
});

test("invalid fields get a message, aria-invalid and focus; nothing is saved", async ({ context, extensionId, sw }) => {
  const page = await context.newPage();
  const tabId = await openPanel(page, extensionId);
  const draft = { id: "01JD0000000000000000000A03", capturedAt: AT, url: f("https://jobs.example.com/y"), title: f("Tester") };
  await putDraft(page, tabId, { mode: "page", draft });

  const title = page.getByLabel("Job title (required)");
  const url = page.getByLabel("Job post address (URL) (required)");
  await title.fill("");
  await url.fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save job" }).click();

  await expect(title).toBeFocused();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toHaveAccessibleDescription("Enter a job title.");
  await expect(url).toHaveAccessibleDescription("Enter the full address from the browser bar, starting with https or http.");
  await expect(page.getByRole("status")).toHaveText("Fix the fields with a message, then save again.");
  expect((await listInWorker(sw)).items).toHaveLength(0);
});

test("the worker keeps openPanelOnActionClick off so toolbar capture still fires", async ({ sw }) => {
  await expect.poll(() => sw.evaluate(() => chrome.sidePanel.getPanelBehavior())).toMatchObject({ openPanelOnActionClick: false });
});

test("the manifest has a side panel and no popup", async ({ manifest }) => {
  const m = await manifest();
  expect(m.side_panel?.default_path).toBe("sidepanel.html");
  expect(m.action?.default_popup).toBeUndefined();
});
