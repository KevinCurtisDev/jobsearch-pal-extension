// The one write path for saved jobs (SPEC §3 F4, F5; ADR-017). SAVE_JOB in the worker and, later, import
// call `saveJob`; nothing else writes `jobs`, `applications` or `applicationEvents`.
// Every row read back is validated with the T1.2 Zod schemas; rows that fail are skipped and counted.
import * as z from "zod/mini";
import "../shared/zod-guard"; // jitless Zod
import { ApplicationEventSchema, ApplicationSchema, InstantSchema, JobDraftSchema, JobSchema, UlidSchema, type Application, type ApplicationEvent, type Job } from "../core/model";
import { applyEvent } from "../core/projection";
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
