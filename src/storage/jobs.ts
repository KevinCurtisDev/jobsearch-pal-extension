// The one write path for saved jobs (SPEC §3 F4, F5, F7; ADR-017). SAVE_JOB in the worker calls `saveJob`,
// a confirmed import calls `importBackup`; nothing else writes `jobs`, `applications` or `applicationEvents`.
// Every row read back is validated with the T1.2 Zod schemas; rows that fail are skipped and counted.
import * as z from "zod/mini";
import "../shared/zod-guard"; // jitless Zod
import { ApplicationEventSchema, ApplicationSchema, InstantSchema, JobDraftSchema, JobSchema, UlidSchema, type Application, type ApplicationEvent, type Job } from "../core/model";
import { planImport, type ExistingIds, type ImportCounts } from "../core/backup";
import { applyEvent, rebuildProjections } from "../core/projection";
import type { Db } from "./db";

/** Id and clock sources. In the extension: a `createUlid({ random: crypto.getRandomValues })` generator. */
export type SaveDeps = { newId: () => string; now: () => string };

export type SaveRecords = { job: Job; application: Application; event: ApplicationEvent };

/**
 * Validates `draft` and builds the three rows one save writes. The application row is the projection of the
 * `created` event, so `rebuildProjections` agrees with it. Throws on invalid input; never generates ids for it.
 */
export function buildSaveRecords(draft: unknown, deps: SaveDeps): SaveRecords {
  const d = JobDraftSchema.parse(draft);
  const at = InstantSchema.parse(deps.now());
  const jobId = UlidSchema.parse(deps.newId());
  const applicationId = UlidSchema.parse(deps.newId());
  const eventId = UlidSchema.parse(deps.newId());
  const fields: Record<string, unknown> = { ...d };
  delete fields.id;
  delete fields.capturedAt;
  const job = JobSchema.parse({ ...fields, id: jobId, draftId: d.id, createdAt: at });
  const event = ApplicationEventSchema.parse({ id: eventId, type: "created", status: "saved", applicationId, jobId, at });
  const application = ApplicationSchema.parse(applyEvent(undefined, event));
  return { job, application, event };
}

export type SaveResult = { jobId: string; created: boolean };

/**
 * Saves a draft: job, application and `created` event in one read-write transaction, so a killed worker
 * leaves either all three or none. Idempotent by draft id: a draft already saved returns its job id.
 */
export async function saveJob(db: Db, draft: unknown, deps: SaveDeps): Promise<SaveResult> {
  const records = buildSaveRecords(draft, deps);
  return db.transaction("rw", db.jobs, db.applications, db.applicationEvents, async () => {
    const existing = JobSchema.safeParse(await db.jobs.where("draftId").equals(records.job.draftId).first());
    if (existing.success) return { jobId: existing.data.id, created: false };
    await db.jobs.add(records.job);
    await db.applications.add(records.application);
    await db.applicationEvents.add(records.event);
    return { jobId: records.job.id, created: true };
  });
}

export type Parsed<T> = { rows: T[]; skipped: number };

/** Keeps the rows `schema` accepts (as parsed) and counts the ones it rejects. */
export function parseRows<S extends z.ZodMiniType>(schema: S, raw: readonly unknown[]): Parsed<z.infer<S>> {
  const rows: z.infer<S>[] = [];
  let skipped = 0;
  for (const r of raw) {
    const p = schema.safeParse(r);
    if (p.success) rows.push(p.data);
    else skipped++;
  }
  return { rows, skipped };
}

/** Sort comparator: newest `createdAt` first, ties broken by id (ULID), also descending. */
export function newestFirst(a: { id: string; createdAt: string }, b: { id: string; createdAt: string }): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export type JobListItem = { job: Job; application: Application | null };
/** `skipped`: stored rows (jobs or applications) that failed validation and were left out. */
export type JobList = { items: JobListItem[]; skipped: number };

/** Saved jobs, newest first, each with its application row (status projection) when one is valid. */
export async function listJobs(db: Db): Promise<JobList> {
  const [rawJobs, rawApps] = await db.transaction("r", db.jobs, db.applications, () => Promise.all([db.jobs.toArray(), db.applications.toArray()]));
  const jobs = parseRows(JobSchema, rawJobs);
  const apps = parseRows(ApplicationSchema, rawApps);
  const byJob = new Map(apps.rows.map((a) => [a.jobId, a]));
  const items = jobs.rows.sort(newestFirst).map((job) => ({ job, application: byJob.get(job.id) ?? null }));
  return { items, skipped: jobs.skipped + apps.skipped };
}

/** Ids already stored, from raw rows: a row counts even if it fails validation, so imports never collide. */
export async function existingIds(db: Db): Promise<ExistingIds> {
  const [jobs, events] = await Promise.all([db.jobs.toArray(), db.applicationEvents.toArray()]);
  const str = (v: unknown): v is string => typeof v === "string";
  const out = { jobIds: new Set<string>(), draftIds: new Map<string, string>(), eventIds: new Set<string>(), appJobs: new Map<string, string>() };
  for (const j of jobs as unknown[]) {
    const r = (j ?? {}) as Record<string, unknown>;
    if (str(r.id)) out.jobIds.add(r.id);
    if (str(r.id) && str(r.draftId)) out.draftIds.set(r.draftId, r.id);
  }
  for (const e of events as unknown[]) {
    const r = (e ?? {}) as Record<string, unknown>;
    if (str(r.id)) out.eventIds.add(r.id);
    if (str(r.applicationId) && str(r.jobId) && !out.appJobs.has(r.applicationId)) out.appJobs.set(r.applicationId, r.jobId);
  }
  return out;
}

const ImportInputSchema = z.strictObject({ jobs: z.array(z.unknown()), events: z.array(z.unknown()) });

/**
 * Confirmed import (F7; ADR-017): the backup's records are re-checked with the same Zod schemas as SAVE_JOB,
 * merged by id and written in one read-write transaction with the application rows rebuilt from the events
 * (X11). Importing the same file again adds nothing. `readInvalid`: records `readBackup` already refused.
 */
export async function importBackup(db: Db, data: unknown, readInvalid = 0): Promise<ImportCounts> {
  const input = ImportInputSchema.parse(data);
  const jobs = parseRows(JobSchema, input.jobs);
  const events = parseRows(ApplicationEventSchema, input.events);
  const invalid = readInvalid + jobs.skipped + events.skipped;
  return db.transaction("rw", db.jobs, db.applications, db.applicationEvents, async () => {
    const plan = planImport({ jobs: jobs.rows, events: events.rows }, invalid, await existingIds(db));
    if (plan.jobs.length > 0) await db.jobs.bulkAdd(plan.jobs);
    if (plan.events.length > 0) await db.applicationEvents.bulkAdd(plan.events);
    const appIds = [...new Set(plan.events.map((e) => e.applicationId))];
    if (appIds.length > 0) {
      const log = parseRows(ApplicationEventSchema, await db.applicationEvents.where("applicationId").anyOf(appIds).toArray());
      await db.applications.bulkPut([...rebuildProjections(log.rows).values()]);
    }
    return plan.counts;
  });
}
