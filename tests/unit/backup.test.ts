import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  MAX_BACKUP_BYTES,
  backupFileName,
  canonicalJson,
  createBackup,
  planImport,
  readBackup,
  type BackupData,
  type ExistingIds,
} from "../../src/core/backup";
import { buildSaveRecords } from "../../src/storage/jobs";

const AT = "2026-11-17T10:00:00.000Z";
const NOW = "2026-11-17T10:05:00.000Z";
const f = <T>(value: T) => ({ value, source: "jsonld", confidence: 0.9, at: AT });

const sha256: (t: string) => Promise<string> = async (text) =>
  Buffer.from(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(text))).toString("hex");

let seq = 0;
function ulid(): string {
  seq++;
  return `01JD${seq.toString().padStart(22, "0")}`;
}

function saved(title: string) {
  const draft = { id: ulid(), capturedAt: AT, url: f("https://jobs.example.com/" + seq), title: f(title) };
  return buildSaveRecords(draft, { newId: ulid, now: () => NOW });
}

function sample(): BackupData {
  const a = saved("Engineer");
  const b = saved("Designer");
  return { jobs: [a.job, b.job], events: [a.event, b.event] };
}

const none = (): ExistingIds => ({ jobIds: new Set(), draftIds: new Map(), eventIds: new Set(), appJobs: new Map() });

function existingFrom(data: BackupData): ExistingIds {
  return {
    jobIds: new Set(data.jobs.map((j) => j.id)),
    draftIds: new Map(data.jobs.map((j) => [j.draftId, j.id])),
    eventIds: new Set(data.events.map((e) => e.id)),
    appJobs: new Map(data.events.map((e) => [e.applicationId, e.jobId])),
  };
}

async function fileText(data = sample()): Promise<string> {
  return JSON.stringify(await createBackup(data, NOW, sha256), null, 2);
}

const read = (text: string, size = text.length) => readBackup(text, size, sha256);

describe("canonicalJson", () => {
  it("sorts keys at every level and ignores spacing", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 0, y: "x" }], c: null } })).toBe('{"a":{"c":null,"d":[1,{"y":"x","z":0}]},"b":1}');
    expect(canonicalJson(JSON.parse('{ "x" : 1 , "a":[ ] }'))).toBe(canonicalJson({ a: [], x: 1 }));
  });
});

describe("createBackup (F6)", () => {
  it("writes format, schemaVersion, exportedAt, records and a SHA-256 checksum", async () => {
    const data = sample();
    const file = await createBackup(data, NOW, sha256);
    expect(file).toMatchObject({ format: BACKUP_FORMAT, schemaVersion: 1, exportedAt: NOW, data });
    expect(file.checksum.algorithm).toBe("SHA-256");
    expect(file.checksum.value).toMatch(/^[0-9a-f]{64}$/);
    expect(backupFileName(NOW)).toBe("jobsearch-pal-backup-2026-11-17.json");
  });

  it("rejects a bad export time", async () => {
    await expect(createBackup(sample(), "today", sha256)).rejects.toThrow();
  });
});

describe("readBackup (F7)", () => {
  it("round-trips an export, whatever the key order or spacing", async () => {
    const data = sample();
    const text = await fileText(data);
    expect(await read(text)).toEqual({ ok: true, exportedAt: NOW, data, invalid: 0 });
    const reordered = JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(text) as object).reverse()));
    expect((await read(reordered)).ok).toBe(true);
  });

  it("refuses files over 10 MB before parsing", async () => {
    expect(await read("{}", MAX_BACKUP_BYTES + 1)).toEqual({ ok: false, error: "too-large" });
  });

  it("refuses corrupt files", async () => {
    for (const text of ["", "{", "null", "[]", '"x"', "42"]) expect(await read(text)).toEqual({ ok: false, error: "corrupt" });
    const file = JSON.parse(await fileText()) as Record<string, unknown>;
    expect(await read(JSON.stringify({ ...file, data: { jobs: "x", events: [] } }))).toEqual({ ok: false, error: "corrupt" });
    expect(await read(JSON.stringify({ ...file, extra: 1 }))).toEqual({ ok: false, error: "corrupt" });
    expect(await read(JSON.stringify({ ...file, checksum: { algorithm: "MD5", value: "x" } }))).toEqual({ ok: false, error: "corrupt" });
  });

  it("refuses other files and other versions", async () => {
    const file = JSON.parse(await fileText()) as Record<string, unknown>;
    expect(await read(JSON.stringify({ name: "x" }))).toEqual({ ok: false, error: "not-backup" });
    expect(await read(JSON.stringify({ ...file, format: "other" }))).toEqual({ ok: false, error: "not-backup" });
    expect(await read(JSON.stringify({ ...file, schemaVersion: 2 }))).toEqual({ ok: false, error: "newer-version" });
    expect(await read(JSON.stringify({ ...file, schemaVersion: 0 }))).toEqual({ ok: false, error: "unsupported-version" });
    expect(await read(JSON.stringify({ ...file, schemaVersion: "1" }))).toEqual({ ok: false, error: "unsupported-version" });
  });

  it("refuses a file changed after export (bad checksum)", async () => {
    const file = JSON.parse(await fileText()) as { data: { jobs: { title: { value: string } }[] }; exportedAt: string };
    file.data.jobs[0]!.title.value = "Changed";
    expect(await read(JSON.stringify(file))).toEqual({ ok: false, error: "bad-checksum" });
    const later = JSON.parse(await fileText()) as Record<string, unknown>;
    expect(await read(JSON.stringify({ ...later, exportedAt: "2026-11-18T00:00:00.000Z" }))).toEqual({ ok: false, error: "bad-checksum" });
  });

  it("counts records that fail the model's schemas as invalid", async () => {
    const data = sample();
    const bad = { jobs: [...data.jobs, { ...data.jobs[0], url: f("javascript:alert(1)") }], events: [...data.events, { id: "x" }] } as unknown as BackupData;
    const r = await read(await fileText(bad));
    expect(r).toMatchObject({ ok: true, invalid: 2, data });
  });
});

describe("planImport (F7, idempotent by id)", () => {
  it("imports everything into an empty profile", () => {
    const data = sample();
    expect(planImport(data, 0, none())).toEqual({ jobs: data.jobs, events: data.events, counts: { newJobs: 2, presentJobs: 0, updatedJobs: 0, invalid: 0 } });
  });

  it("adds nothing the second time", () => {
    const data = sample();
    const p = planImport(data, 1, existingFrom(data));
    expect(p.jobs).toEqual([]);
    expect(p.events).toEqual([]);
    expect(p.counts).toEqual({ newJobs: 0, presentJobs: 2, updatedJobs: 0, invalid: 1 });
  });

  it("adds new events to a stored job as an update", () => {
    const data = sample();
    const first = data.events[0]!;
    const change = { ...first, id: ulid(), type: "status_changed" as const, status: "applied" as const };
    const p = planImport({ ...data, events: [...data.events, change] }, 0, existingFrom(data));
    expect(p.events).toEqual([change]);
    expect(p.counts).toEqual({ newJobs: 0, presentJobs: 2, updatedJobs: 1, invalid: 0 });
  });

  it("refuses a job whose draft is stored under another id, and its events", () => {
    const data = sample();
    const stored = existingFrom({ jobs: [{ ...data.jobs[0]!, id: ulid() }], events: [] });
    const p = planImport(data, 0, stored);
    expect(p.jobs.map((j) => j.id)).toEqual([data.jobs[1]!.id]);
    expect(p.events.map((e) => e.id)).toEqual([data.events[1]!.id]);
    expect(p.counts).toEqual({ newJobs: 1, presentJobs: 0, updatedJobs: 0, invalid: 2 });
  });

  it("refuses events for unknown jobs or for an application of another job; dedupes ids in the file", () => {
    const data = sample();
    const orphan = { ...data.events[0]!, id: ulid(), jobId: ulid() };
    const crossed = { ...data.events[0]!, id: ulid(), type: "status_changed" as const, jobId: data.jobs[1]!.id };
    const p = planImport({ jobs: [...data.jobs, data.jobs[0]!], events: [...data.events, data.events[0]!, orphan, crossed] }, 0, none());
    expect(p.jobs).toEqual(data.jobs);
    expect(p.events).toEqual(data.events);
    expect(p.counts.invalid).toBe(2);
  });
});

describe("panel texts", async () => {
  const { importedText, previewLines, sha256Hex } = await import("../../src/sidepanel/backup");
  it("shows new / already saved / invalid counts, and updates only when there are some", () => {
    expect(previewLines({ newJobs: 2, presentJobs: 1, updatedJobs: 0, invalid: 0 })).toEqual(["New jobs: 2", "Already saved: 1", "Invalid records (skipped): 0"]);
    expect(previewLines({ newJobs: 0, presentJobs: 1, updatedJobs: 1, invalid: 3 })).toContain("Saved jobs with new history: 1");
    expect(importedText({ newJobs: 1, presentJobs: 0, updatedJobs: 0, invalid: 0 })).toBe("Imported 1 new job. They're in your list below.");
    expect(importedText({ newJobs: 0, presentJobs: 2, updatedJobs: 0, invalid: 0 })).toBe("Nothing new was imported.");
  });
  it("hashes like node's SHA-256", async () => {
    expect(await sha256Hex("héllo")).toBe(await sha256("héllo"));
  });
});
