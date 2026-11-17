import { describe, expect, it } from "vitest";
import {
  ApplicationEventSchema,
  ApplicationSchema,
  DateOnlySchema,
  InstantSchema,
  JobDraftSchema,
  JobSchema,
  LIMITS,
  PaySchema,
} from "../../src/core/model";

const AT = "2026-11-17T10:00:00.000Z";
const ID = "01JD0000000000000000000000";
const ID2 = "01JD0000000000000000000001";
const f = <T>(value: T, source = "jsonld") => ({ value, source, confidence: 0.9, at: AT });

const draft = () => ({
  id: ID,
  capturedAt: AT,
  url: f("https://boards.greenhouse.io/acme/jobs/1"),
  title: f("Engineer"),
  company: f("Acme"),
  pay: f({ currency: "USD", period: "year", minMinor: 10_000_000, maxMinor: 12_000_000 }),
});

describe("JobDraft and Job schemas (F2, F4)", () => {
  it("accepts a draft whose fields carry source, confidence and time", () => {
    expect(JobDraftSchema.safeParse(draft()).success).toBe(true);
    expect(JobDraftSchema.safeParse({ ...draft(), company: undefined, pay: undefined }).success).toBe(true);
  });

  it("requires provenance on every field", () => {
    const d = draft();
    for (const key of ["source", "confidence", "at"] as const) {
      const title: Record<string, unknown> = { ...d.title };
      delete title[key];
      expect(JobDraftSchema.safeParse({ ...d, title }).success).toBe(false);
    }
    expect(JobDraftSchema.safeParse({ ...d, title: f("x", "selection") }).success).toBe(false);
    expect(JobDraftSchema.safeParse({ ...d, title: { ...f("x"), confidence: 1.5 } }).success).toBe(false);
  });

  it("rejects oversized and empty strings", () => {
    const d = draft();
    expect(JobDraftSchema.safeParse({ ...d, title: f("a".repeat(LIMITS.title)) }).success).toBe(true);
    expect(JobDraftSchema.safeParse({ ...d, title: f("a".repeat(LIMITS.title + 1)) }).success).toBe(false);
    expect(JobDraftSchema.safeParse({ ...d, title: f("   ") }).success).toBe(false);
    expect(JobDraftSchema.safeParse({ ...d, description: f("a".repeat(LIMITS.description + 1)) }).success).toBe(false);
    const longUrl = "https://example.com/" + "a".repeat(LIMITS.url);
    expect(JobDraftSchema.safeParse({ ...d, url: f(longUrl) }).success).toBe(false);
  });

  it("accepts only http(s) URLs", () => {
    const d = draft();
    expect(JobDraftSchema.safeParse({ ...d, url: f("http://example.com/job") }).success).toBe(true);
    for (const u of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "chrome://settings", "ftp://x.com", "/relative", "example.com"]) {
      expect(JobDraftSchema.safeParse({ ...d, url: f(u) }).success, u).toBe(false);
    }
  });

  it("rejects unknown keys and bad ids", () => {
    expect(JobDraftSchema.safeParse({ ...draft(), extra: 1 }).success).toBe(false);
    expect(JobDraftSchema.safeParse({ ...draft(), id: "not-a-ulid" }).success).toBe(false);
  });

  it("a job is a draft's fields plus id, draftId and createdAt", () => {
    const fields: Record<string, unknown> = draft();
    delete fields.capturedAt;
    expect(JobSchema.safeParse({ ...fields, id: ID2, draftId: ID, createdAt: AT }).success).toBe(true);
    expect(JobSchema.safeParse({ ...fields, id: ID2, createdAt: AT }).success).toBe(false);
  });
});

describe("money and dates", () => {
  it("money is integer minor units, ISO 4217 currency and a period", () => {
    const ok = { currency: "EUR", period: "hour", minMinor: 2500, maxMinor: 2500 };
    expect(PaySchema.safeParse(ok).success).toBe(true);
    expect(PaySchema.safeParse({ ...ok, minMinor: 25.5 }).success).toBe(false);
    expect(PaySchema.safeParse({ ...ok, minMinor: -1 }).success).toBe(false);
    expect(PaySchema.safeParse({ ...ok, maxMinor: 100 }).success).toBe(false);
    expect(PaySchema.safeParse({ ...ok, currency: "eur" }).success).toBe(false);
    expect(PaySchema.safeParse({ ...ok, currency: "EURO" }).success).toBe(false);
    expect(PaySchema.safeParse({ ...ok, period: "fortnight" }).success).toBe(false);
    expect(PaySchema.safeParse({ ...ok, minMinor: 2 ** 53, maxMinor: 2 ** 53 }).success).toBe(false);
  });

  it("date-only values are YYYY-MM-DD and instants are ISO UTC", () => {
    expect(DateOnlySchema.safeParse("2026-11-17").success).toBe(true);
    for (const v of ["2026-11-17T00:00:00Z", "17/11/2026", "2026-13-01", "2026-1-1"]) {
      expect(DateOnlySchema.safeParse(v).success, v).toBe(false);
    }
    expect(InstantSchema.safeParse(AT).success).toBe(true);
    expect(InstantSchema.safeParse("2026-11-17T10:00:00Z").success).toBe(true);
    for (const v of ["2026-11-17T10:00:00+01:00", "2026-11-17", "2026-11-17T10:00:00"]) {
      expect(InstantSchema.safeParse(v).success, v).toBe(false);
    }
  });
});

describe("application and events (F5, X11)", () => {
  it("validates events by type", () => {
    const base = { id: ID, applicationId: ID2, jobId: ID, at: AT };
    expect(ApplicationEventSchema.safeParse({ ...base, type: "created", status: "saved" }).success).toBe(true);
    expect(ApplicationEventSchema.safeParse({ ...base, type: "status_changed", status: "applied" }).success).toBe(true);
    expect(ApplicationEventSchema.safeParse({ ...base, type: "deleted", status: "saved" }).success).toBe(false);
    expect(ApplicationEventSchema.safeParse({ ...base, type: "created", status: "ghosted" }).success).toBe(false);
  });

  it("validates application rows", () => {
    const row = { id: ID2, jobId: ID, status: "saved", appliedAt: null, createdAt: AT, updatedAt: AT };
    expect(ApplicationSchema.safeParse(row).success).toBe(true);
    expect(ApplicationSchema.safeParse({ ...row, appliedAt: "2026-11-17" }).success).toBe(true);
    expect(ApplicationSchema.safeParse({ ...row, appliedAt: AT }).success).toBe(false);
  });
});
