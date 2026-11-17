// Accessibility (SPEC §3 F8; P8; ADR-016): axe finds no serious or critical WCAG 2.2 A/AA issues in the
// side panel's empty, review and list states, nor in the import dry-run. Keyboard flow, 44 px targets and
// visible focus are covered in sidepanel.spec.ts and backup.spec.ts.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { BRAND_NAME } from "../../src/core/brand";
import { expect, test } from "./fixtures";

const AT = "2026-11-17T10:00:00.000Z";
const f = <T>(value: T) => ({ value, source: "jsonld", confidence: 0.9, at: AT });
const draft = { id: "01JD0000000000000000000C01", capturedAt: AT, url: f("https://jobs.example.com/a11y"), title: f("Widget Engineer"), company: f("Example Widgets Ltd"), description: f("Build widgets.") };

async function openPanel(page: Page, extensionId: string): Promise<number> {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(BRAND_NAME);
  return page.evaluate(async () => (await chrome.tabs.getCurrent())!.id!);
}

/** Serious or critical axe violations, as "rule: target" lines (empty when clean). */
async function seriousIssues(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`));
}

test("the panel has no serious or critical axe issues: empty, review, list and import dry-run", async ({ context, extensionId }) => {
  const page = await context.newPage();
  const tabId = await openPanel(page, extensionId);

  await expect(page.getByText("No saved jobs yet")).toBeVisible();
  expect(await seriousIssues(page), "empty").toEqual([]);

  await page.evaluate(([key, value]) => chrome.storage.session.set({ [key as string]: value }), [`draft.${tabId}`, { mode: "page", draft }] as const);
  await expect(page.getByLabel("Job title (required)")).toHaveValue("Widget Engineer");
  expect(await seriousIssues(page), "review").toEqual([]);

  // Errors shown on the form.
  await page.getByLabel("Job title (required)").fill("");
  await page.getByRole("button", { name: "Save job" }).click();
  await expect(page.getByLabel("Job title (required)")).toHaveAttribute("aria-invalid", "true");
  expect(await seriousIssues(page), "review with errors").toEqual([]);

  await page.getByLabel("Job title (required)").fill("Widget Engineer");
  await page.getByRole("button", { name: "Save job" }).click();
  await expect(page.getByRole("listitem").getByRole("link")).toHaveText("Widget Engineer");
  expect(await seriousIssues(page), "list").toEqual([]);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export backup" }).click()]);
  await page.getByLabel("Import a backup file").setInputFiles((await download.path())!);
  await expect(page.getByRole("group", { name: "Before you import" })).toBeVisible();
  expect(await seriousIssues(page), "import dry-run").toEqual([]);
});

test("canary: axe reports an issue planted in the panel, so a clean result is not a blind spot", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await openPanel(page, extensionId);
  await page.evaluate(() => document.querySelector("main")!.append(Object.assign(document.createElement("input"), { type: "text" })));
  expect((await seriousIssues(page)).some((line) => line.startsWith("label: "))).toBe(true);
});
