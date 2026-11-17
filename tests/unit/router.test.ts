import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetHandlers, on, route } from "../../src/background/router";
import { isSaveJob, registerSaveJob } from "../../src/background/save";
import { isOwnSender, isExtensionPage, isPing, isReply, SAVE_JOB } from "../../src/shared/messages";
import { isPingMessage } from "../../src/shared/zod-guard";

const saveJobMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/storage/jobs", () => ({ saveJob: saveJobMock }));

const ID = "abcdefghijklmnopabcdefghijklmnop";
const own = { id: ID } as chrome.runtime.MessageSender;

describe("router", () => {
  afterEach(() => _resetHandlers());

  it("answers a valid message from this extension", async () => {
    on("ping", isPing, () => ({ version: "1.0.0" }));
    await expect(route({ type: "ping" }, own, ID)).resolves.toEqual({ ok: true, data: { version: "1.0.0" } });
  });

  it("ignores other extensions, web pages and malformed messages", () => {
    on("ping", isPing, () => 1);
    expect(route({ type: "ping" }, { id: "other" } as chrome.runtime.MessageSender, ID)).toBeNull();
    expect(route({ type: "ping" }, {} as chrome.runtime.MessageSender, ID)).toBeNull();
    expect(route("ping", own, ID)).toBeNull();
    expect(route({ type: "unknown" }, own, ID)).toBeNull();
    expect(route(null, own, ID)).toBeNull();
  });

  it("rejects messages its validator refuses", () => {
    on("ping", isPing, () => 1);
    expect(route({ type: "ping" }, own, "")).toBeNull();
  });

  it("turns a thrown handler error into a short error reply", async () => {
    on("ping", isPing, () => {
      throw new Error("x".repeat(500));
    });
    const r = await route({ type: "ping" }, own, ID);
    expect(r?.ok).toBe(false);
    if (r && !r.ok) expect(r.error.length).toBe(200);
  });

  it("refuses duplicate handlers", () => {
    on("ping", isPing, () => 1);
    expect(() => on("ping", isPing, () => 2)).toThrow(/duplicate/);
  });
});

describe("ping validated with Zod (zod-guard)", () => {
  afterEach(() => _resetHandlers());

  it("accepts exactly { type: \"ping\" }", () => {
    expect(isPingMessage({ type: "ping" })).toBe(true);
    for (const bad of [{ type: "ping", extra: 1 }, { type: "pong" }, {}, null, "ping", [{ type: "ping" }]]) expect(isPingMessage(bad)).toBe(false);
  });

  it("routes ping through the Zod guard and drops malformed pings", async () => {
    on("ping", isPingMessage, () => ({ version: "1.0.0" }));
    await expect(route({ type: "ping" }, own, ID)).resolves.toEqual({ ok: true, data: { version: "1.0.0" } });
    expect(route({ type: "ping", extra: "x" }, own, ID)).toBeNull();
  });
});

describe("sender checks", () => {
  const origin = `chrome-extension://${ID}/`;
  it("identifies extension pages", () => {
    expect(isExtensionPage({ id: ID, url: `${origin}popup.html` }, ID, origin)).toBe(true);
    expect(isExtensionPage({ id: ID, url: `${origin}popup.html` }, ID, "")).toBe(false);
    expect(isExtensionPage({ id: ID, url: "https://example.com/" }, ID, origin)).toBe(false);
    expect(isOwnSender({ id: undefined }, ID)).toBe(false);
  });
  it("validates replies", () => {
    expect(isReply({ ok: true, data: null })).toBe(true);
    expect(isReply({ ok: false, error: "e" })).toBe(true);
    expect(isReply({ ok: false })).toBe(false);
    expect(isReply("ok")).toBe(false);
  });
});

describe("SAVE_JOB (F4)", () => {
  const AT = "2026-11-17T10:00:00.000Z";
  const JOB_ID = "01JD0000000000000000000010";
  const f = <T>(value: T) => ({ value, source: "jsonld" as const, confidence: 0.9, at: AT });
  const draft = { id: "01JD0000000000000000000000", capturedAt: AT, url: f("https://boards.greenhouse.io/acme/jobs/1"), title: f("Engineer") };
  const origin = `chrome-extension://${ID}/`;
  const page = { id: ID, url: `${origin}sidepanel.html` } as chrome.runtime.MessageSender;
  const saved: unknown[] = [];

  beforeEach(() => {
    saved.length = 0;
    saveJobMock.mockReset();
    saveJobMock.mockImplementation(async (_db: unknown, d: unknown) => {
      saved.push(d);
      return { jobId: JOB_ID, created: true };
    });
    registerSaveJob({ db: () => ({}) as never, save: { newId: () => JOB_ID, now: () => AT }, runtimeId: () => ID, extOrigin: () => origin });
  });
  afterEach(() => _resetHandlers());

  it("is a versioned strict union: v1 with a valid draft only", () => {
    expect(isSaveJob({ type: SAVE_JOB, v: 1, draft })).toBe(true);
    for (const bad of [{ type: SAVE_JOB, draft }, { type: SAVE_JOB, v: 2, draft }, { type: SAVE_JOB, v: 1, draft, extra: 1 }, { type: SAVE_JOB, v: 1, draft: { ...draft, url: f("javascript:alert(1)") } }, { type: SAVE_JOB, v: 1 }]) expect(isSaveJob(bad)).toBe(false);
  });

  it("saves from an extension page and replies with { jobId } only", async () => {
    await expect(route({ type: SAVE_JOB, v: 1, draft }, page, ID)).resolves.toEqual({ ok: true, data: { jobId: JOB_ID } });
    expect(saved).toEqual([draft]);
  });

  it("refuses scripts injected into web pages and other extensions", async () => {
    const injected = { id: ID, url: "https://boards.greenhouse.io/acme/jobs/1", tab: { id: 3 } } as unknown as chrome.runtime.MessageSender;
    await expect(route({ type: SAVE_JOB, v: 1, draft }, injected, ID)).resolves.toEqual({ ok: false, error: "forbidden" });
    expect(route({ type: SAVE_JOB, v: 1, draft }, { id: "other", url: `chrome-extension://other/x.html` } as chrome.runtime.MessageSender, ID)).toBeNull();
    expect(saveJobMock).not.toHaveBeenCalled();
  });

  it("drops malformed SAVE_JOB messages without saving", () => {
    expect(route({ type: SAVE_JOB, v: 1, draft: { ...draft, title: f("") } }, page, ID)).toBeNull();
    expect(saveJobMock).not.toHaveBeenCalled();
  });

  it("reports a failed save as an error reply", async () => {
    saveJobMock.mockRejectedValueOnce(new Error("QuotaExceededError"));
    await expect(route({ type: SAVE_JOB, v: 1, draft }, page, ID)).resolves.toEqual({ ok: false, error: "QuotaExceededError" });
  });
});
