// IndexedDB through Dexie (ADR-004): records and the event log live here; chrome.storage keeps small
// settings only. v1 has one `meta` store (key → value); the data model arrives in M1.
// Every row read back is validated with Zod before use (hard rule 4).
import { Dexie, type EntityTable } from "dexie";
import * as z from "zod/mini";
import "../shared/zod-guard"; // jitless Zod

export const DB_NAME = "jobsearch-pal";

export const MetaRowSchema = z.strictObject({ key: z.string().check(z.minLength(1), z.maxLength(100)), value: z.unknown() });
export type MetaRow = z.infer<typeof MetaRowSchema>;

export type Db = Dexie & { meta: EntityTable<MetaRow, "key"> };

/** Opens (and creates on first use) the `jobsearch-pal` database at version 1. */
export function openDb(): Db {
  const db = new Dexie(DB_NAME) as Db;
  db.version(1).stores({ meta: "key" });
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
