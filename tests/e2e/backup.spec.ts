// JSON backup and dry-run import (SPEC §3 F6, F7; ADR-017): export through a blob URL and <a download>,
// refusal of bad files with plain messages, the dry-run counts, a confirmed import into a fresh profile
// that gives an identical event log, and a second import that adds nothing.
import { readFileSync } from "node:fs";
import type { BrowserContext, Page, Worker } from "@playwright/test";
import { BRAND_NAME } from "../../src/core/brand";
import { expect, launchExtension, readyWorker, test } from "./fixtures";

const AT = "2026-11-17T10:00:00.000Z";
const f = <T>(value: T) => ({ value, source: "jsonld", confidence: 0.9, at: AT });

type Rows = { jobs: Record<string, unknown>[]; applications: Record<string, unknown>[]; events: Record<string, unknown>[] };
type Hook = {
  openDb: () => { close(): void } & Record<"jobs" | "applications" | "applicationEvents", { toArray(): Promise<Record<string, unknown>[]> }>;
  saveJob: (db: unknown, draft: unknown) => Promise<unknown>;
};

const dump = (sw: Worker) =>
  sw.evaluate(async () => {
    const db = (globalThis as unknown as { __jspDb: Hook }).__jspDb.openDb();
    const byId = (a: Record<string, unknown>, b: Record<string, unknown>) => String(a.id).localeCompare(String(b.id));
    const out = { jobs: (await db.jobs.toArray()).sort(byId), applications: (await db.applications.toArray()).sort(byId), events: (await db.applicationEvents.toArray()).sort(byId) };
    db.close();
    return out;
  }) as Promise<Rows>;

async function seed(sw: Worker, drafts: unknown[]): Promise<void> {
  await sw.evaluate(async (list) => {
    const hook = (globalThis as unknown as { __jspDb: Hook }).__jspDb;
    const db = hook.openDb();
    for (const d of list) await hook.saveJob(db, d);
    db.close();
  }, drafts);
}

async function openPanel(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(BRAND_NAME);
  return page;
}

const drafts = [
  { id: "01JD0000000000000000000B01", capturedAt: AT, url: f("https://jobs.example.com/1"), title: f("Widget Engineer"), company: f("Example Widgets Ltd") },
  { id: "01JD0000000000000000000B02", capturedAt: AT, url: f("https://jobs.example.com/2"), title: f("Data Gardener"), pay: f({ currency: "EUR", period: "year", minMinor: 5_000_000, maxMinor: 6_000_000 }) },
];

const status = (page: Page) => page.locator("#backup-status");
const fileInput = (page: Page) => page.getByLabel("Import a backup file");

async function exportFile(page: Page): Promise<{ name: string; text: string }> {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export backup" }).click()]);
  expect(download.url()).toMatch(/^blob:chrome-extension:\/\//);
  return { name: download.suggestedFilename(), text: readFileSync((await download.path())!, "utf8") };
}

test("export then import into a fresh profile gives an identical event log; a second import adds nothing", async ({ context, extensionId, sw }) => {
  await seed(sw, drafts);
  const before = await dump(sw);
  expect(before.events).toHaveLength(2);

  const page = await openPanel(context, extensionId);
  const { name, text } = await exportFile(page);
  expect(name).toMatch(/^jobsearch-pal-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(status(page)).toHaveText(`Backup ready: ${name}, with 2 jobs.`);
  const file = JSON.parse(text) as Record<string, unknown> & { data: { jobs: unknown[]; events: unknown[] }; checksum: { algorithm: string; value: string } };
  expect(file).toMatchObject({ format: "jobsearch-pal-backup", schemaVersion: 1 });
  expect(file.checksum.algorithm).toBe("SHA-256");
  expect(file.checksum.value).toMatch(/^[0-9a-f]{64}$/);
  expect(file.data.jobs).toEqual(before.jobs);
  expect(file.data.events).toEqual(before.events);

  const fresh = await launchExtension();
  try {
    const sw2 = await readyWorker(fresh);
    const id2 = new URL(sw2.url()).host;
    const panel = await openPanel(fresh, id2);
    await expect(panel.getByText("No saved jobs yet")).toBeVisible();

    await fileInput(panel).setInputFiles({ name, mimeType: "application/json", buffer: Buffer.from(text) });
    const preview = panel.getByRole("group", { name: "Before you import" });
    await expect(preview.getByRole("listitem")).toHaveText(["New jobs: 2", "Already saved: 0", "Invalid records (skipped): 0"]);
    expect((await dump(sw2)).events).toEqual([]); // the dry-run writes nothing

    // 44 px targets at 320 px for the new controls.
    for (const target of [panel.getByRole("button", { name: "Export backup" }), fileInput(panel), preview.getByRole("button", { name: "Import" }), preview.getByRole("button", { name: "Cancel" })]) {
      const box = (await target.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
    }
    expect(await panel.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

    await preview.getByRole("button", { name: "Import" }).press("Enter");
    await expect(status(panel)).toHaveText("Imported 2 new jobs. They're in your list below.");
    await expect(panel.getByRole("listitem").getByRole("link")).toHaveText(["Data Gardener", "Widget Engineer"]);
    await expect(fileInput(panel)).toBeFocused();

    const after = await dump(sw2);
    expect(after.events).toEqual(before.events);
    expect(after.jobs).toEqual(before.jobs);
    expect(after.applications).toEqual(before.applications);

    // Same file again: everything already present, nothing to import, nothing written.
    await fileInput(panel).setInputFiles({ name, mimeType: "application/json", buffer: Buffer.from(text) });
    await expect(panel.getByRole("group", { name: "Before you import" }).getByRole("listitem")).toHaveText(["New jobs: 0", "Already saved: 2", "Invalid records (skipped): 0"]);
    await expect(status(panel)).toHaveText("Nothing new to import: this file has nothing that isn't already saved.");
    await expect(panel.getByRole("button", { name: "Import", exact: true })).toHaveCount(0);
    expect(await dump(sw2)).toEqual(after);
  } finally {
    await fresh.close();
  }
});

test("bad files are refused with plain messages and nothing is written", async ({ context, extensionId, sw }) => {
  await seed(sw, drafts.slice(0, 1));
  const page = await openPanel(context, extensionId);
  const { name, text } = await exportFile(page);
  const before = await dump(sw);
  const file = JSON.parse(text) as Record<string, unknown> & { data: { jobs: { title: { value: string } }[] } };

  const tampered = structuredClone(file);
  tampered.data.jobs[0]!.title.value = "Changed";
  const cases: [string, Buffer, string][] = [
    ["corrupt", Buffer.from(text.slice(0, -5)), "This file can't be read. It may be damaged, or it isn't a backup file."],
    ["other", Buffer.from(JSON.stringify({ hello: "world" })), `This isn't a ${BRAND_NAME} backup file. Choose the file you exported.`],
    ["newer", Buffer.from(JSON.stringify({ ...file, schemaVersion: 2 })), `This backup was made by a newer version of ${BRAND_NAME}. Update the extension, then import it again.`],
    ["checksum", Buffer.from(JSON.stringify(tampered)), "This file was changed or damaged after it was exported, so it can't be imported."],
    ["huge", Buffer.alloc(10 * 1024 * 1024 + 1, 0x20), "This file is over 10 MB, so it isn't a backup from this extension. Choose another file."],
  ];
  for (const [label, buffer, message] of cases) {
    await fileInput(page).setInputFiles({ name: `${label}-${name}`, mimeType: "application/json", buffer });
    await expect(status(page), label).toHaveText(message);
    await expect(page.getByRole("group", { name: "Before you import" })).toHaveCount(0);
  }

  // A valid file, cancelled at the dry-run, also writes nothing.
  const other = { ...drafts[1]!, id: "01JD0000000000000000000B09" };
  const fresh = await launchExtension();
  let otherText: string;
  try {
    const sw2 = await readyWorker(fresh);
    await seed(sw2, [other]);
    otherText = (await exportFile(await openPanel(fresh, new URL(sw2.url()).host))).text;
  } finally {
    await fresh.close();
  }
  await fileInput(page).setInputFiles({ name: "other.json", mimeType: "application/json", buffer: Buffer.from(otherText) });
  const preview = page.getByRole("group", { name: "Before you import" });
  await expect(preview.getByRole("listitem")).toHaveText(["New jobs: 1", "Already saved: 0", "Invalid records (skipped): 0"]);
  await preview.getByRole("button", { name: "Cancel" }).click();
  await expect(status(page)).toHaveText("Import cancelled. Nothing was added.");
  expect(await dump(sw)).toEqual(before);
});
