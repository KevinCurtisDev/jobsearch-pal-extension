// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { manualDraft, MANUAL_TITLE_CONFIDENCE } from "../../src/core/draft";
import { activateTab, probe, type ActivationDeps } from "../../src/page-inject/activate";
import { parseTabDraft } from "../../src/page-inject/report";
import { draftKey, saveTabDraft, tabDraft } from "../../src/page-inject/report-store";
import { answerCapture } from "../../src/page/collect";
import { CAPTURE_JOB, parseCaptureReply } from "../../src/shared/messages";
import { PRODUCT } from "../../src/shared/product";
import { installFakeStorage } from "./fake-storage";

const RID = "ext-id";
const ID = "01JD0000000000000000000000";
const ID2 = "01JD0000000000000000000001";
const AT = "2026-11-17T10:00:00.000Z";
const REQ = { type: CAPTURE_JOB, v: 1, id: ID, now: AT };
const WORKER = { id: RID };

function page(html: string, title = "A page"): Document {
  const doc = document.implementation.createHTMLDocument(title);
  doc.body.append(Object.assign(doc.createElement("div"), { textContent: html }));
  return doc;
}

describe("manualDraft", () => {
  it("builds a URL-only draft from the tab URL and title", () => {
    const d = manualDraft("https://www.linkedin.com/jobs/view/1", "  Data   Gardener | LinkedIn ", { id: ID, now: AT });
    expect(d).toEqual({
      id: ID,
      capturedAt: AT,
      url: { value: "https://www.linkedin.com/jobs/view/1", source: "manual", confidence: 1, at: AT },
      title: { value: "Data Gardener | LinkedIn", source: "manual", confidence: MANUAL_TITLE_CONFIDENCE, at: AT }
    });
    expect(manualDraft("https://example.com/x", "", { id: ID, now: AT })?.title.value).toBe("example.com");
    expect(manualDraft("https://u:p@Example.com:8443/x", " ", { id: ID, now: AT })?.title.value).toBe("example.com");
    expect(manualDraft("https://example.com/x", "t".repeat(400), { id: ID, now: AT })?.title.value).toHaveLength(300);
    for (const u of ["chrome://settings/", "file:///tmp/a.html", "javascript:alert(1)", undefined]) expect(manualDraft(u, "x", { id: ID, now: AT })).toBeNull();
  });
});

describe("answerCapture (page script)", () => {
  it("answers CAPTURE_JOB from the worker without changing the page", () => {
    const doc = page("Hello", "Gadget Tester - Sample");
    const snapshot = () => doc.documentElement.cloneNode(true);
    const before = snapshot();
    const r = answerCapture(REQ, WORKER, RID, doc, "https://jobs.example.test/1");
    expect(r?.draft?.id).toBe(ID);
    expect(r?.draft?.title.value).toBe("Gadget Tester - Sample");
    expect(doc.documentElement.isEqualNode(before)).toBe(true);
    expect(snapshot().isEqualNode(before)).toBe(true);
  });

  it("ignores other senders, content scripts and malformed requests", () => {
    const doc = page("x");
    const href = "https://jobs.example.test/1";
    expect(answerCapture(REQ, { id: "other" }, RID, doc, href)).toBeNull();
    expect(answerCapture(REQ, {}, RID, doc, href)).toBeNull();
    expect(answerCapture(REQ, { id: RID, tab: { id: 3 } }, RID, doc, href)).toBeNull();
    expect(answerCapture({ ...REQ, v: 2 }, WORKER, RID, doc, href)).toBeNull();
    expect(answerCapture({ ...REQ, id: "nope" }, WORKER, RID, doc, href)).toBeNull();
    expect(answerCapture({ ...REQ, extra: 1 }, WORKER, RID, doc, href)).toBeNull();
    expect(answerCapture({ type: "ping" }, WORKER, RID, doc, href)).toBeNull();
  });

  it("reads nothing on an X3 site or a non-http page", () => {
    expect(answerCapture(REQ, WORKER, RID, page("x"), "https://www.linkedin.com/jobs/1")).toEqual({ draft: null });
    expect(answerCapture(REQ, WORKER, RID, page("x"), "file:///tmp/a.html")).toEqual({ draft: null });
  });
});

describe("parseCaptureReply (worker)", () => {
  const draft = manualDraft("https://example.com/", "T", { id: ID, now: AT });
  it("accepts a valid draft for the requested id only", () => {
    expect(parseCaptureReply({ draft }, ID)).toEqual(draft);
    expect(parseCaptureReply({ draft: null }, ID)).toBeNull();
    expect(parseCaptureReply({ draft }, ID2)).toBeUndefined();
  });
  it("rejects malformed replies", () => {
    expect(parseCaptureReply(undefined, ID)).toBeUndefined();
    expect(parseCaptureReply({ draft, extra: 1 }, ID)).toBeUndefined();
    expect(parseCaptureReply({ draft: { ...draft, url: { ...draft!.url, value: "javascript:alert(1)" } } }, ID)).toBeUndefined();
    expect(parseCaptureReply({ draft: { ...draft, title: { ...draft!.title, value: "x".repeat(301) } } }, ID)).toBeUndefined();
  });
});

describe("tab drafts in session storage", () => {
  it("stores validated entries per tab and refuses invalid ones", async () => {
    const storage = installFakeStorage();
    const draft = manualDraft("https://www.linkedin.com/jobs/1", "T", { id: ID, now: AT })!;
    await saveTabDraft(4, { mode: "url-only", reason: "x3", draft });
    expect(storage.session.data.has("draft.4")).toBe(true);
    expect(storage.local.data.size).toBe(0);
    expect(await tabDraft(4)).toEqual({ mode: "url-only", reason: "x3", draft });
    expect(await tabDraft(5)).toBeNull();
    await storage.session.set({ "draft.6": { mode: "page", draft: { ...draft, id: "bad" } } });
    expect(await tabDraft(6)).toBeNull();
    expect(parseTabDraft({ mode: "url-only", draft })).toBeNull(); // url-only needs a reason
    expect(draftKey(4).area).toBe("session");
  });
});

describe("probe", () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>)[PRODUCT.pageFlag];
  });
  it("reports absent, finds a live handle, replaces a dead one", () => {
    const w = window as unknown as Record<string, unknown>;
    expect(probe(PRODUCT.pageFlag)).toBe("absent");
    w[PRODUCT.pageFlag] = { alive: () => true };
    expect(probe(PRODUCT.pageFlag)).toBe("present");
    const retire = vi.fn();
    w[PRODUCT.pageFlag] = { alive: () => false, retire };
    expect(probe(PRODUCT.pageFlag)).toBe("absent");
    expect(retire).toHaveBeenCalledOnce();
    expect(w[PRODUCT.pageFlag]).toBeUndefined();
  });
});

describe("activateTab", () => {
  type Call = { func?: unknown; files?: string[] };
  type Opts = { url?: string; title?: string; status?: string; probe?: string; fail?: string; tabMissing?: boolean; reply?: (msg: { id: string; now: string }) => unknown };
  let n = 0;
  const deps: ActivationDeps = { newId: () => `01JD00000000000000000000${String(n++ % 100).padStart(2, "0")}`, now: () => AT };

  function fakeChrome(opts: Opts) {
    const calls: Call[] = [];
    const sent: { msg: unknown; options: unknown }[] = [];
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: {
        get: async () => {
          if (opts.tabMissing) throw new Error("No tab with id: 5");
          return { url: opts.url, title: opts.title ?? "Tab title", status: opts.status ?? "complete" };
        },
        sendMessage: async (_tabId: number, msg: { id: string; now: string }, options: unknown) => {
          sent.push({ msg, options });
          if (opts.reply) return opts.reply(msg);
          return answerCapture(msg, WORKER, RID, page("x", opts.title ?? "Tab title"), opts.url ?? "");
        }
      },
      extension: { isAllowedFileSchemeAccess: async () => false },
      scripting: {
        executeScript: async (inj: Call) => {
          calls.push(inj);
          if (opts.fail) throw new Error(opts.fail);
          if (inj.func === probe) return [{ result: opts.probe ?? "absent" }];
          return [{}];
        }
      }
    };
    return { calls, sent };
  }

  it("injects once, sends CAPTURE_JOB to the top frame and returns the page draft", async () => {
    const { calls, sent } = fakeChrome({ url: "https://jobs.example.test/1", title: "Gadget Tester" });
    const r = await activateTab(5, deps);
    expect(r.kind === "captured" && r.entry.mode).toBe("page");
    expect(r.kind === "captured" && r.entry.draft.title.value).toBe("Gadget Tester");
    expect(calls.some((c) => c.files?.includes("page.js"))).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.options).toEqual({ frameId: 0 });
    expect(sent[0]!.msg).toMatchObject({ type: CAPTURE_JOB, v: 1, now: AT });
    const again = fakeChrome({ url: "https://jobs.example.test/1", probe: "present" });
    expect((await activateTab(5, deps)).kind).toBe("captured");
    expect(again.calls.some((c) => c.files)).toBe(false);
  });

  it("never injects on X3 sites: URL-only draft from the tab", async () => {
    for (const url of ["https://www.linkedin.com/jobs/view/1", "https://ie.indeed.com/viewjob?jk=1", "https://www.glassdoor.co.uk/job-listing/x.htm"]) {
      const { calls, sent } = fakeChrome({ url, title: "Job | Site" });
      const r = await activateTab(11, deps);
      expect(calls).toEqual([]);
      expect(sent).toEqual([]);
      expect(r).toMatchObject({ kind: "captured", entry: { mode: "url-only", reason: "x3", draft: { url: { value: url, source: "manual" }, title: { value: "Job | Site" } } } });
    }
  });

  it("injects nothing when the tab URL is hidden (X3 can't be ruled out)", async () => {
    const { calls } = fakeChrome({});
    expect(await activateTab(12, deps)).toEqual({ kind: "unavailable", reason: "no-access" });
    expect(calls).toEqual([]);
  });

  it("falls back to a URL-only draft on an invalid or mismatched reply", async () => {
    fakeChrome({ url: "https://jobs.example.test/2", reply: () => ({ draft: { id: "x" } }) });
    expect(await activateTab(13, deps)).toMatchObject({ kind: "captured", entry: { mode: "url-only", reason: "blocked" } });
    const other = manualDraft("https://jobs.example.test/2", "T", { id: ID2, now: AT });
    fakeChrome({ url: "https://jobs.example.test/2", reply: () => ({ draft: other }) });
    const r = await activateTab(13, deps);
    expect(r).toMatchObject({ kind: "captured", entry: { mode: "url-only" } });
    expect(r.kind === "captured" && r.entry.draft.id).not.toBe(ID2);
  });

  it("restricted pages: nothing injected, nothing to save", async () => {
    const { calls } = fakeChrome({ url: "chrome://settings/" });
    expect(await activateTab(6, deps)).toEqual({ kind: "unavailable", reason: "restricted" });
    expect(calls).toEqual([]);
  });

  it("classifies a missing grant, a closed tab and a navigation", async () => {
    fakeChrome({ url: "https://jobs.example.test/3", fail: "Cannot access contents of the page. Extension manifest must request permission to access the respective host." });
    expect(await activateTab(7, deps)).toMatchObject({ kind: "captured", entry: { mode: "url-only", reason: "no-access" } });
    fakeChrome({ tabMissing: true });
    expect((await activateTab(8, deps)).kind).toBe("gone");
    fakeChrome({ url: "https://jobs.example.test/3", fail: "Frame with ID 0 was removed." });
    expect((await activateTab(9, deps)).kind).toBe("gone");
  });

  it("queues activations per tab", async () => {
    const order: string[] = [];
    fakeChrome({ url: "https://example.com/" });
    await Promise.all([activateTab(10, deps).then(() => order.push("a")), activateTab(10, deps).then(() => order.push("b"))]);
    expect(order).toEqual(["a", "b"]);
  });
});
