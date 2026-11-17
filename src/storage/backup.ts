// Backup reads (SPEC §3 F6, F7): the records an export writes and the dry-run of an import. Read-only;
// the confirmed import writes through `importBackup` in src/storage/jobs.ts (ADR-017).
import { planImport, type BackupData, type ImportCounts } from "../core/backup";
import { ApplicationEventSchema, JobSchema } from "../core/model";
import type { Db } from "./db";
import { existingIds, parseRows } from "./jobs";

/** Every valid job and event, in id order. `skipped`: stored rows that failed validation and are left out. */
export async function readBackupData(db: Db): Promise<{ data: BackupData; skipped: number }> {
  const [rawJobs, rawEvents] = await db.transaction("r", db.jobs, db.applicationEvents, () => Promise.all([db.jobs.toArray(), db.applicationEvents.toArray()]));
  const jobs = parseRows(JobSchema, rawJobs);
  const events = parseRows(ApplicationEventSchema, rawEvents);
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { data: { jobs: jobs.rows.sort(byId), events: events.rows.sort(byId) }, skipped: jobs.skipped + events.skipped };
}

/** Dry-run: what a confirmed import of `data` would do now. Writes nothing. */
export async function previewImport(db: Db, data: BackupData, readInvalid: number): Promise<ImportCounts> {
  const existing = await db.transaction("r", db.jobs, db.applicationEvents, () => existingIds(db));
  return planImport(data, readInvalid, existing).counts;
}
