// Dexie + Zod in the service worker (T0.5, ADR-004): one `meta` row round-trips through IndexedDB.
import { expect, test } from "./fixtures";

type DbHook = {
  openDb: () => { name: string; verno: number; tables: { name: string }[]; open: () => Promise<unknown>; close: () => void };
  putMeta: (db: unknown, key: string, value: unknown) => Promise<void>;
  getMeta: (db: unknown, key: string) => Promise<unknown>;
};

test("the worker opens jobsearch-pal v1 with one meta store and round-trips a row", async ({ sw }) => {
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
  expect(result.shape).toEqual({ name: "jobsearch-pal", verno: 1, tables: ["meta"] });
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
