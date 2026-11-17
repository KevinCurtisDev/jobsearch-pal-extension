// IndexedDB through Dexie (ADR-004): records and the event log live here; chrome.storage keeps small
// settings only. v1 has one `meta` store (key → value); v2 (M1, ADR-017) adds `jobs`, `applications` and
// `applicationEvents`. Writes to those go only through src/storage/jobs.ts.
// Every row read back is validated with Zod before use (hard rule 4).
import { Dexie, type EntityTable } from "dexie";
import * as z from "zod/mini";
import "../shared/zod-guard"; // jitless Zod
import type { Application, ApplicationEvent, Job } from "../core/model";

export const DB_NAME = "jobsearch-pal";

export const MetaRowSchema = z.strictObject({ key: z.string().check(z.minLength(1), z.maxLength(100)), value: z.unknown() });
export type MetaRow = z.infer<typeof MetaRowSchema>;

export type Db = Dexie & {
  meta: EntityTable<MetaRow, "key">;
  jobs: EntityTable<Job, "id">;
  applications: EntityTable<Application, "id">;
  applicationEvents: EntityTable<ApplicationEvent, "id">;
};

/** Current schema version (Dexie's; IndexedDB sees it ×10). */
export const DB_VERSION = 2;

/**
 * Opens (and creates or upgrades on first use) the `jobsearch-pal` database. v1 → v2 only adds stores, so
 * `meta` rows are kept. `jobs.draftId` is unique: one job per draft.
 */
export function openDb(): Db {
  const db = new Dexie(DB_NAME) as Db;
  db.version(1).stores({ meta: "key" });
  db.version(2).stores({
    meta: "key",
    jobs: "id, &draftId, createdAt",
    applications: "id, jobId",
    applicationEvents: "id, applicationId, jobId",
  });
  return db;
}

export async function putMeta(db: Db, key: string, value: unknown): Promise<void> {
  await db.meta.put(MetaRowSchema.parse({ key, value }));
}

/** The stored value, or undefined when the row is absent or fails validation. */
export async function getMeta(db: Db, key: string): Promise<unknown> {
  const parsed = MetaRowSchema.safeParse(await db.meta.get(key));
  return parsed.success ? parsed.data.value : undefined;
}
