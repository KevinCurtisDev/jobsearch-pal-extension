// Offline e2e (SPEC §6, X1): the main flows make zero external requests. The `net` fixture aborts and
// records anything that is not the local test origin or chrome-extension://. The canary tests prove the
// guard sees page and service-worker requests, so a zero below is not a blind spot.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, launchExtension, readyWorker, test } from "./fixtures";
import { handleState, waitForDraft } from "./page-helpers";

const CANARY = "https://example.invalid/canary";

/**
 * The worker starts with the browser, before context.route can be installed. For worker start we use
 * Chromium's net log instead, which records every URL request from launch (pages and workers). `during`
 * runs once the worker is ready; the URLs seen are returned after the browser closes.
 */
async function netLogUrls(during: (sw: Awaited<ReturnType<typeof readyWorker>>) => Promise<unknown>): Promise<string[]> {
  const dir = mkdtempSync(path.join(tmpdir(), "jsp-netlog-"));
  const log = path.join(dir, "net.json");
  try {
    const context = await launchExtension([`--log-net-log=${log}`, "--net-log-capture-mode=Everything"]);
    try {
      await during(await readyWorker(context));
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      await context.close();
    }
    const urls = readFileSync(log, "utf8").match(/"url":"[^"]+"/g) ?? [];
    return [...new Set(urls.map((u) => u.slice(7, -1)))];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("canary: the guard aborts and records a page request", async ({ context, origin, net }) => {
  const page = await context.newPage();
  await page.goto(`${origin}/basic.html?canary-page`);
  const failed = await page.evaluate((u) => fetch(u).then(() => false, () => true), CANARY);
  expect(failed).toBe(true);
  expect(net.external).toEqual([{ url: CANARY, from: "page" }]);
});

test("canary: the guard aborts and records a service-worker request", async ({ sw, net }) => {
  const failed = await sw.evaluate((u) => fetch(u).then(() => false, () => true), CANARY);
  expect(failed).toBe(true);
  expect(net.external).toEqual([{ url: CANARY, from: "sw" }]);
});

test("canary: the net log records a service-worker request", async () => {
  const urls = await netLogUrls((sw) => sw.evaluate((u) => fetch(u).catch(() => 0), CANARY));
  expect(urls).toContain(CANARY);
});

test("worker start makes no external requests (net log from launch)", async () => {
  const urls = await netLogUrls(async () => {});
  expect(urls.filter((u) => /^(https?|wss?):/.test(u))).toEqual([]);
});

test("opening sidepanel.html makes no external requests", async ({ context, extensionId, net }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(page.getByRole("heading", { level: 2, name: "Saved jobs" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(net.external).toEqual([]);
});

test("toolbar capture on basic.html makes no external requests", async ({ context, origin, sw, clickAction, net }) => {
  const page = await context.newPage();
  await page.goto(`${origin}/basic.html?offline`);
  await clickAction(page);
  expect((await waitForDraft(sw, page)).mode).toBe("page");
  expect(await handleState(sw, page)).toMatchObject({ present: true });
  await page.waitForLoadState("networkidle");
  expect(net.external).toEqual([]);
});
