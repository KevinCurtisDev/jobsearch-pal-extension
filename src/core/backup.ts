// JSON backup file (SPEC §3 F6, F7; X9, X11). Pure: the caller passes in the SHA-256 function (Web Crypto
// is a browser API) and the file's byte size. The file holds the jobs and the append-only event log; the
// `applications` rows are projections, rebuilt from the events on import.
import * as z from "zod/mini";
import "../shared/zod-guard"; // jitless Zod
import { BRAND_NAME } from "./brand";
import { ApplicationEventSchema, InstantSchema, JobSchema, type ApplicationEvent, type Job } from "./model";

export const BACKUP_FORMAT = "jobsearch-pal-backup";
export const BACKUP_SCHEMA_VERSION = 1;
/** Files over this size are refused before they are read (F7). */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

/** SHA-256 of the UTF-8 text, as lowercase hex. */
export type Digest = (text: string) => Promise<string>;

export type BackupData = { jobs: Job[]; events: ApplicationEvent[] };

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  checksum: { algorithm: "SHA-256"; value: string };
  data: BackupData;
};

/** JSON with object keys sorted at every level, so the checksum doesn't depend on key order or spacing. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v ?? null)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** What the checksum covers: everything in the file except the checksum itself. */
function checksumInput(f: { format: unknown; schemaVersion: unknown; exportedAt: unknown; data: unknown }): string {
  return canonicalJson({ format: f.format, schemaVersion: f.schemaVersion, exportedAt: f.exportedAt, data: f.data });
}

/** Builds the backup file for `data` (already validated rows) at `exportedAt`. */
export async function createBackup(data: BackupData, exportedAt: string, digest: Digest): Promise<BackupFile> {
  const at = InstantSchema.parse(exportedAt);
  const body = { format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: at, data: { jobs: data.jobs, events: data.events } } as const;
  return { ...body, checksum: { algorithm: "SHA-256", value: await digest(checksumInput(body)) } };
}

/** `jobsearch-pal-backup-YYYY-MM-DD.json`, from the export time (UTC date). */
export function backupFileName(exportedAt: string): string {
  return `${BACKUP_FORMAT}-${InstantSchema.parse(exportedAt).slice(0, 10)}.json`;
}

export type ReadError = "too-large" | "corrupt" | "not-backup" | "newer-version" | "unsupported-version" | "bad-checksum";

/** Plain messages for each reason a file is refused. */
export const READ_ERROR_MESSAGES: Record<ReadError, string> = {
  "too-large": "This file is over 10 MB, so it isn't a backup from this extension. Choose another file.",
  corrupt: "This file can't be read. It may be damaged, or it isn't a backup file.",
  "not-backup": `This isn't a ${BRAND_NAME} backup file. Choose the file you exported.`,
  "newer-version": `This backup was made by a newer version of ${BRAND_NAME}. Update the extension, then import it again.`,
  "unsupported-version": "This backup's format version isn't supported, so it can't be imported.",
  "bad-checksum": "This file was changed or damaged after it was exported, so it can't be imported.",
};

const HEX64 = /^[0-9a-f]{64}$/;
const EnvelopeSchema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: InstantSchema,
  checksum: z.strictObject({ algorithm: z.literal("SHA-256"), value: z.string().check(z.regex(HEX64)) }),
  data: z.strictObject({ jobs: z.array(z.unknown()), events: z.array(z.unknown()) }),
});

export type ReadBackup = { ok: true; exportedAt: string; data: BackupData; invalid: number } | { ok: false; error: ReadError };

/** Keeps the rows `schema` accepts and counts the rest. */
function keepValid<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, raw: readonly unknown[]): { rows: T[]; invalid: number } {
  const rows: T[] = [];
  let invalid = 0;
  for (const r of raw) {
    const p = schema.safeParse(r);
    if (p.success) rows.push(p.data);
    else invalid++;
  }
  return { rows, invalid };
}

/**
 * Checks a chosen file: size, JSON, format, version, checksum, then each record against the model's Zod
 * schemas (the same ones SAVE_JOB uses). Records that fail are counted as invalid, not imported.
 */
export async function readBackup(text: string, byteLength: number, digest: Digest): Promise<ReadBackup> {
  if (byteLength > MAX_BACKUP_BYTES || text.length > MAX_BACKUP_BYTES) return { ok: false, error: "too-large" };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "corrupt" };
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "corrupt" };
  const top = raw as Record<string, unknown>;
  if (top.format !== BACKUP_FORMAT) return { ok: false, error: "not-backup" };
  if (typeof top.schemaVersion === "number" && Number.isInteger(top.schemaVersion) && top.schemaVersion > BACKUP_SCHEMA_VERSION) return { ok: false, error: "newer-version" };
  if (top.schemaVersion !== BACKUP_SCHEMA_VERSION) return { ok: false, error: "unsupported-version" };
  const env = EnvelopeSchema.safeParse(raw);
  if (!env.success) return { ok: false, error: "corrupt" };
  if ((await digest(checksumInput(env.data))) !== env.data.checksum.value) return { ok: false, error: "bad-checksum" };
  const jobs = keepValid<Job>(JobSchema, env.data.data.jobs);
  const events = keepValid<ApplicationEvent>(ApplicationEventSchema, env.data.data.events);
  return { ok: true, exportedAt: env.data.exportedAt, data: { jobs: jobs.rows, events: events.rows }, invalid: jobs.invalid + events.invalid };
}

/** Ids already in the database (from raw rows: anything stored counts, valid or not). */
export type ExistingIds = {
  jobIds: ReadonlySet<string>;
  /** draftId → job id */
  draftIds: ReadonlyMap<string, string>;
  eventIds: ReadonlySet<string>;
  /** applicationId → job id, from stored events */
  appJobs: ReadonlyMap<string, string>;
};

export type ImportCounts = {
  /** Jobs not in this browser yet. */
  newJobs: number;
  /** Jobs already here (same id). */
  presentJobs: number;
  /** Jobs already here that get history (events) they don't have yet. */
  updatedJobs: number;
  /** Records refused: failed validation, conflict with a stored job, or point at a job that isn't there. */
  invalid: number;
};

export type ImportPlan = { jobs: Job[]; events: ApplicationEvent[]; counts: ImportCounts };

/**
 * What a confirmed import would add, merged by id: jobs and events already stored are skipped, so the same
 * file imported twice adds nothing. A job whose draft was already saved under another id is refused (the
 * draft id is unique), and so is an event for a job that is neither stored nor imported, or whose
 * application belongs to a different job. `readInvalid` is the count `readBackup` refused.
 */
export function planImport(data: BackupData, readInvalid: number, existing: ExistingIds): ImportPlan {
  let invalid = readInvalid;
  const jobs: Job[] = [];
  const seenJobs = new Set<string>();
  const presentIds = new Set<string>();
  const newDrafts = new Set<string>();
  for (const job of data.jobs) {
    if (seenJobs.has(job.id)) continue;
    seenJobs.add(job.id);
    if (existing.jobIds.has(job.id)) {
      presentIds.add(job.id);
    } else if (existing.draftIds.has(job.draftId) || newDrafts.has(job.draftId)) {
      invalid++;
    } else {
      newDrafts.add(job.draftId);
      jobs.push(job);
    }
  }
  const known = new Set([...existing.jobIds, ...jobs.map((j) => j.id)]);
  const appJobs = new Map(existing.appJobs);
  const events: ApplicationEvent[] = [];
  const seenEvents = new Set<string>();
  const updated = new Set<string>();
  for (const e of data.events) {
    if (seenEvents.has(e.id)) continue;
    seenEvents.add(e.id);
    if (existing.eventIds.has(e.id)) continue;
    const owner = appJobs.get(e.applicationId);
    if (!known.has(e.jobId) || (owner !== undefined && owner !== e.jobId)) {
      invalid++;
      continue;
    }
    appJobs.set(e.applicationId, e.jobId);
    events.push(e);
    if (existing.jobIds.has(e.jobId)) updated.add(e.jobId);
  }
  return { jobs, events, counts: { newJobs: jobs.length, presentJobs: presentIds.size, updatedJobs: updated.size, invalid } };
}
