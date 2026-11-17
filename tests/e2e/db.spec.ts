// Dexie + Zod in the service worker (T0.5, T1.3, ADR-004, ADR-017): meta round-trip, the v1 → v2 upgrade,
// saveJob (one transaction, idempotent by draft id, atomic when the browser is killed) and listJobs.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, launchExtension, readyWorker, test } from "./fixtures";

type Table = { toArray: () => Promise<Record<string, unknown>[]>; count: () => Promise<number>; put: (row: unknown) => Promise<unknown> };
type HookDb = { name: string; verno: number; tables: { name: string }[]; open: () => Promise<unknown>; close: () => void; jobs: Table; applications: Table; applicationEvents: Table };
type DbHook = {
  openDb: () => HookDb;
  putMeta: (db: unknown, key: string, value: unknown) => Promise<void>;
  getMeta: (db: unknown, key: string) => Promise<unknown>;
  saveJob: (db: unknown, draft: unknown) => Promise<{ jobId: string; created: boolean }>;
  listJobs: (db: unknown) => Promise<{ items: { job: { id: string; title: { value: string } }; application: { status: string } | null }[]; skipped: number }>;
};

test("the worker opens jobsearch-pal v2 with four stores and round-trips a meta row", async ({ sw }) => {
  const result = await sw.evaluate(async () => {
    const hook = (globalThis as unknown as { __jspDb: DbHook }).__jspDb;
    const db = hook.openDb();
    await db.open();
    await hook.putMeta(db, "schema-check", { n: 1, s: "ok" });
    const value = await hook.getMeta(db, "schema-check");
    const missing = await hook.getMeta(db, "absent");
    const shape = { name: db.name, verno: db.verno, tables: db.tables.map((t) => t.name) };
    db.close();
    return { value, missing, shape };
  });
  expect(result.shape).toEqual({ name: "jobsearch-pal", verno: 2, tables: ["meta", "jobs", "applications", "applicationEvents"] });
  expect(result.value).toEqual({ n: 1, s: "ok" });
  expect(result.missing).toBeUndefined();
});

test("ping is answered through the Zod-validated router", async ({ context, extensionId, manifest }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const replies = await page.evaluate(async () => [await chrome.runtime.sendMessage({ type: "ping" }), await chrome.runtime.sendMessage({ type: "ping", extra: 1 })]);
  expect(replies[0]).toEqual({ ok: true, data: { version: (await manifest()).version } });
  expect(replies[1]).toBeUndefined();
});

test("upgrading a v1 database to v2 keeps its meta rows", async ({ sw }) => {
  const result = await sw.evaluate(async () => {
    // Build the v1 database as T0.5 shipped it (Dexie version 1 = IndexedDB version 10), with raw IndexedDB.
    await new Promise<void>((resolve, reject) => {
      const del = indexedDB.deleteDatabase("jobsearch-pal");
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
    });
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("jobsearch-pal", 10);
      req.onupgradeneeded = () => req.result.createObjectStore("meta", { keyPath: "key" }).put({ key: "installedAt", value: "2026-11-01" });
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    const hook = (globalThis as unknown as { __jspDb: DbHook }).__jspDb;
    const db = hook.openDb();
    await db.open();
    const out = { verno: db.verno, tables: db.tables.map((t) => t.name), kept: await hook.getMeta(db, "installedAt"), jobs: await db.jobs.count() };
    db.close();
    return out;
  });
  expect(result).toEqual({ verno: 2, tables: ["meta", "jobs", "applications", "applicationEvents"], kept: "2026-11-01", jobs: 0 });
});

const draftExpr = (n: number) => ({
  id: `01JD${String(n).padStart(22, "0")}`,
  capturedAt: "2026-11-17T10:00:00.000Z",
  url: { value: `https://example.com/jobs/${n}`, source: "manual", confidence: 1, at: "2026-11-17T10:00:00.000Z" },
  title: { value: `Job ${n}`, source: "manual", confidence: 1, at: "2026-11-17T10:00:00.000Z" },
});

test("saveJob writes one job, application and created event per draft; listJobs is newest first and skips bad rows", async ({ sw }) => {
  const drafts = [1, 2, 3].map(draftExpr);
  const result = await sw.evaluate(async (drafts) => {
    const hook = (globalThis as unknown as { __jspDb: DbHook }).__jspDb;
    const db = hook.openDb();
    await db.open();
    const first = [];
    for (const d of drafts) first.push(await hook.saveJob(db, d));
    const again = await hook.saveJob(db, drafts[0]);
    const invalid = await hook.saveJob(db, { ...drafts[0], url: { ...drafts[0]!.url, value: "javascript:alert(1)" } }).then(
      () => "saved",
      () => "rejected"
    );
    const counts = [await db.jobs.count(), await db.applications.count(), await db.applicationEvents.count()];
    const events = await db.applicationEvents.toArray();
    const before = await hook.listJobs(db);
    await db.jobs.put({ id: "not-a-ulid", title: "corrupt" });
    await db.applications.put({ id: "also-bad" });
    const after = await hook.listJobs(db);
    db.close();
    return { first, again, invalid, counts, events, before, after };
  }, drafts);
  expect(result.first.every((r) => r.created)).toBe(true);
  expect(result.again).toEqual({ jobId: result.first[0]!.jobId, created: false });
  expect(result.invalid).toBe("rejected");
  expect(result.counts).toEqual([3, 3, 3]);
  expect(result.events.map((e) => [e.type, e.status])).toEqual([["created", "saved"], ["created", "saved"], ["created", "saved"]]);
  expect(result.before.items.map((i) => i.job.title.value)).toEqual(["Job 3", "Job 2", "Job 1"]);
  expect(result.before.items.map((i) => i.application?.status)).toEqual(["saved", "saved", "saved"]);
  expect(result.before.skipped).toBe(0);
  expect(result.after.items.map((i) => i.job.id)).toEqual(result.before.items.map((i) => i.job.id));
  expect(result.after.skipped).toBe(2);
});

test("killing the browser mid-save leaves every save complete or absent, never partial", async () => {
  test.setTimeout(90_000);
  test.skip(process.platform === "win32", "uses pgrep/SIGKILL");
  const dir = mkdtempSync(path.join(tmpdir(), "jsp-kill-"));
  try {
    const context = await launchExtension([], dir);
    const sw = await readyWorker(context);
    // A save loop that runs until the browser dies; large descriptions make each transaction take a while.
    await sw.evaluate(() => {
      const hook = (globalThis as unknown as { __jspDb: DbHook }).__jspDb;
      const db = hook.openDb();
      const at = "2026-11-17T10:00:00.000Z";
      const description = { value: "x".repeat(49_000), source: "manual", confidence: 1, at };
      void (async () => {
        for (let n = 1; ; n++) {
          const id = `01JD${String(n).padStart(22, "0")}`;
          const draft = { id, capturedAt: at, url: { value: `https://example.com/jobs/${n}`, source: "manual", confidence: 1, at }, title: { value: `Job ${n}`, source: "manual", confidence: 1, at }, description };
          // Several saves in flight at once, so the kill lands with transactions open.
          await Promise.all([hook.saveJob(db, draft), hook.saveJob(db, { ...draft, id: `01JE${id.slice(4)}` })]);
        }
      })();
    });
    await expect.poll(() => sw.evaluate(async () => {
      const db = (globalThis as unknown as { __jspDb: DbHook }).__jspDb.openDb();
      const n = await db.jobs.count();
      db.close();
      return n;
    }), { timeout: 30_000, intervals: [50] }).toBeGreaterThanOrEqual(20);

    // SIGKILL every Chromium process of this profile: no clean shutdown, open transactions are cut off.
    const pids = execFileSync("pgrep", ["-f", "--", `--user-data-dir=${dir}`], { encoding: "utf8" }).split("\n").filter(Boolean).map(Number);
    expect(pids.length).toBeGreaterThan(0);
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // already gone
      }
    }
    await context.close().catch(() => {});

    const reopened = await launchExtension([], dir);
    try {
      const sw2 = await readyWorker(reopened);
      const state = await sw2.evaluate(async () => {
        const hook = (globalThis as unknown as { __jspDb: DbHook }).__jspDb;
        const db = hook.openDb();
        await db.open();
        const [jobs, apps, events] = [await db.jobs.toArray(), await db.applications.toArray(), await db.applicationEvents.toArray()];
        const list = await hook.listJobs(db);
        db.close();
        return { jobs, apps, events, skipped: list.skipped, listed: list.items.length };
      });
      const jobIds = state.jobs.map((j) => j.id as string).sort();
      expect(jobIds.length).toBeGreaterThanOrEqual(20);
      expect(state.apps.map((a) => a.jobId as string).sort()).toEqual(jobIds);
      expect(state.events.map((e) => e.jobId as string).sort()).toEqual(jobIds);
      const appIds = new Set(state.apps.map((a) => a.id));
      expect(state.events.every((e) => e.type === "created" && appIds.has(e.applicationId))).toBe(true);
      expect(new Set(state.jobs.map((j) => j.draftId)).size).toBe(jobIds.length);
      expect(state.skipped).toBe(0);
      expect(state.listed).toBe(jobIds.length);
    } finally {
      await reopened.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
