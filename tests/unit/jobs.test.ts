import { describe, expect, it } from "vitest";
import { buildSaveRecords, newestFirst, parseRows } from "../../src/storage/jobs";
import { ApplicationEventSchema, ApplicationSchema, JobSchema, rebuildProjections } from "../../src/core";

const AT = "2026-11-17T10:00:00.000Z";
const NOW = "2026-11-17T10:05:00.000Z";
const DRAFT_ID = "01JD0000000000000000000000";
const f = <T>(value: T) => ({ value, source: "jsonld", confidence: 0.9, at: AT });
const draft = () => ({ id: DRAFT_ID, capturedAt: AT, url: f("https://boards.greenhouse.io/acme/jobs/1"), title: f("Engineer"), company: f("Acme") });

function ids(): () => string {
  const list = ["01JD0000000000000000000010", "01JD0000000000000000000011", "01JD0000000000000000000012"];
  return () => {
    const next = list.shift();
    if (!next) throw new Error("out of ids");
    return next;
  };
}

describe("buildSaveRecords (F4)", () => {
  it("builds a valid job, application and created event that agree with the projection", () => {
    const r = buildSaveRecords(draft(), { newId: ids(), now: () => NOW });
    expect(JobSchema.parse(r.job)).toEqual(r.job);
    expect(ApplicationSchema.parse(r.application)).toEqual(r.application);
    expect(ApplicationEventSchema.parse(r.event)).toEqual(r.event);
    expect(r.job).toMatchObject({ draftId: DRAFT_ID, createdAt: NOW, title: f("Engineer") });
    expect(Object.keys(r.job).sort()).toEqual(["company", "createdAt", "draftId", "id", "title", "url"]);
    expect(r.event).toMatchObject({ type: "created", status: "saved", jobId: r.job.id, applicationId: r.application.id, at: NOW });
    expect(rebuildProjections([r.event]).get(r.application.id)).toEqual(r.application);
  });

  it("rejects an invalid draft before generating ids", () => {
    let calls = 0;
    const newId = () => {
      calls++;
      return "01JD0000000000000000000010";
    };
    expect(() => buildSaveRecords({ ...draft(), url: f("javascript:alert(1)") }, { newId, now: () => NOW })).toThrow();
    expect(() => buildSaveRecords({ ...draft(), extra: 1 }, { newId, now: () => NOW })).toThrow();
    expect(() => buildSaveRecords(null, { newId, now: () => NOW })).toThrow();
    expect(calls).toBe(0);
  });

  it("rejects a bad clock or id source", () => {
    expect(() => buildSaveRecords(draft(), { newId: () => "nope", now: () => NOW })).toThrow();
    expect(() => buildSaveRecords(draft(), { newId: ids(), now: () => "yesterday" })).toThrow();
  });
});

describe("parseRows (hard rule 4)", () => {
  it("keeps rows that pass the schema and counts the rest", () => {
    const good = buildSaveRecords(draft(), { newId: ids(), now: () => NOW }).job;
    const out = parseRows(JobSchema, [good, { ...good, title: f("") }, null, "x", { ...good, extra: true }]);
    expect(out.rows).toEqual([good]);
    expect(out.skipped).toBe(4);
  });
});

describe("newestFirst", () => {
  it("orders by createdAt, then id, descending", () => {
    const a = { id: "01JD0000000000000000000001", createdAt: "2026-11-17T10:00:00.000Z" };
    const b = { id: "01JD0000000000000000000002", createdAt: "2026-11-17T10:00:00.000Z" };
    const c = { id: "01JD0000000000000000000000", createdAt: "2026-11-18T09:00:00.000Z" };
    expect([a, b, c].sort(newestFirst).map((x) => x.id)).toEqual([c.id, b.id, a.id]);
  });
});
