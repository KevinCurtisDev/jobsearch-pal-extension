import { afterEach, describe, expect, it } from "vitest";
import { _resetHandlers, on, route } from "../../src/background/router";
import { isOwnSender, isExtensionPage, isPing, isReply } from "../../src/shared/messages";
import { isPingMessage } from "../../src/shared/zod-guard";

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
