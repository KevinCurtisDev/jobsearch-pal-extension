// M1 data model (SPEC §3 F2, F4, F5; ADR-017; source 17 §3). Zod schemas used at every boundary:
// SAVE_JOB, Dexie rows read back, import files. Pure: no browser APIs (G3).
import * as z from "zod/mini";
import "../shared/zod-guard"; // jitless Zod
import { ULID_PATTERN } from "./ulid";

/** Upper bounds for captured text (characters). Anything longer is rejected, not truncated. */
export const LIMITS = {
  title: 300,
  company: 200,
  location: 300,
  url: 2048,
  description: 50_000,
} as const;

export const UlidSchema = z.string().check(z.regex(ULID_PATTERN));

/** Instant: ISO 8601 in UTC with a `Z` suffix (no offsets). */
export const InstantSchema = z.iso.datetime();
/** Date-only value: `YYYY-MM-DD`. */
export const DateOnlySchema = z.iso.date();

const text = (max: number) => z.string().check(z.trim(), z.minLength(1), z.maxLength(max));

/** Absolute http(s) URL only (no javascript:, data:, file:, chrome: …). */
export const HttpUrlSchema = z.url({ protocol: /^https?$/, normalize: false }).check(z.maxLength(LIMITS.url));

export const CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const PayPeriodSchema = z.enum(["year", "month", "week", "day", "hour"]);

/** Pay as integer minor units (e.g. cents) with ISO 4217 currency and period. No floats, no FX. */
export const PaySchema = z
  .strictObject({
    currency: z.string().check(z.regex(CURRENCY_PATTERN)),
    period: PayPeriodSchema,
    minMinor: z.int().check(z.nonnegative(), z.maximum(Number.MAX_SAFE_INTEGER)),
    maxMinor: z.int().check(z.nonnegative(), z.maximum(Number.MAX_SAFE_INTEGER)),
  })
  .check(z.refine((p) => p.maxMinor >= p.minMinor, { message: "maxMinor < minMinor", path: ["maxMinor"] }));
export type Pay = z.infer<typeof PaySchema>;

/** Where a field value came from (F2). */
export const FieldSourceSchema = z.enum(["jsonld", "adapter", "manual"]);
export type FieldSource = z.infer<typeof FieldSourceSchema>;

/** A captured value with provenance: source, confidence in [0, 1] and capture time. */
function field<T extends z.ZodMiniType>(value: T) {
  return z.strictObject({
    value,
    source: FieldSourceSchema,
    confidence: z.number().check(z.minimum(0), z.maximum(1)),
    at: InstantSchema,
  });
}

const jobFields = {
  url: field(HttpUrlSchema),
  title: field(text(LIMITS.title)),
  company: z.optional(field(text(LIMITS.company))),
  location: z.optional(field(text(LIMITS.location))),
  description: z.optional(field(text(LIMITS.description))),
  pay: z.optional(field(PaySchema)),
};

/** What capture produces and the panel edits; `id` makes SAVE_JOB idempotent. */
export const JobDraftSchema = z.strictObject({ id: UlidSchema, capturedAt: InstantSchema, ...jobFields });
export type JobDraft = z.infer<typeof JobDraftSchema>;

/** A saved job (Dexie `jobs`). `draftId` is unique: saving the same draft twice is a no-op. */
export const JobSchema = z.strictObject({ id: UlidSchema, draftId: UlidSchema, createdAt: InstantSchema, ...jobFields });
export type Job = z.infer<typeof JobSchema>;

/**
 * Application statuses: the product brief's six (`docs/PRODUCT_BRIEF.md`). M1 only writes `saved`;
 * status editing arrives in M2 (SPEC §7).
 */
export const STATUSES = ["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"] as const;
export const StatusSchema = z.enum(STATUSES);
export type Status = z.infer<typeof StatusSchema>;

const eventBase = { id: UlidSchema, applicationId: UlidSchema, jobId: UlidSchema, at: InstantSchema };

/** Append-only event log (`applicationEvents`): the source of truth (X11). */
export const ApplicationEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...eventBase, type: z.literal("created"), status: StatusSchema }),
  z.strictObject({ ...eventBase, type: z.literal("status_changed"), status: StatusSchema }),
]);
export type ApplicationEvent = z.infer<typeof ApplicationEventSchema>;

/** Dexie `applications` row: every field except `id`/`jobId` is a projection of the events. */
export const ApplicationSchema = z.strictObject({
  id: UlidSchema,
  jobId: UlidSchema,
  status: StatusSchema,
  appliedAt: z.nullable(DateOnlySchema),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export type Application = z.infer<typeof ApplicationSchema>;
