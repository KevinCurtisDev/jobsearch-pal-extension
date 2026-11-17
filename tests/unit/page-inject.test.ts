// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activateTab, probeAndToggle, readReport } from "../../src/page-inject/activate";
import { parseReport, reportRows } from "../../src/page-inject/report";
import { collectReport } from "../../src/page/collect";
import { PRODUCT } from "../../src/shared/product";

describe("report", () => {
  it("collects page facts without changing the page", () => {
    document.documentElement.setAttribute("lang", "en");
    document.title = "Hello";
    document.body.replaceChildren();
    for (const tag of ["h1", "h2", "a", "img"]) {
      const el = document.createElement(tag);
      if (tag === "a") el.setAttribute("href", "/x");
      document.body.append(el);
    }
    const before = document.body.childElementCount;
    const r = collectReport(document, { host: "example.com" });
    expect(r).toEqual({ title: "Hello", host: "example.com", lang: "en", headings: 2, links: 1, images: 1 });
    expect(document.body.childElementCount).toBe(before);
    expect(parseReport(r)).toEqual(r);
    expect(reportRows(r)[0]).toEqual(["Title", "Hello"]);
  });

  it("rejects malformed reports", () => {
    expect(parseReport(null)).toBeNull();
    expect(parseReport({ title: "x".repeat(301), host: "", lang: "", headings: 0, links: 0, images: 0 })).toBeNull();
    expect(parseReport({ title: "", host: "", lang: "", headings: -1, links: 0, images: 0 })).toBeNull();
    expect(parseReport({ title: "", host: "", lang: "", headings: 1.5, links: 0, images: 0 })).toBeNull();
  });
});

describe("probe", () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>)[PRODUCT.pageFlag];
  });
  it("reports absent, toggles a live handle, replaces a dead one", () => {
    const w = window as unknown as Record<string, unknown>;
    expect(probeAndToggle(PRODUCT.pageFlag)).toBe("absent");
    const toggle = vi.fn();
    w[PRODUCT.pageFlag] = { toggle, alive: () => true, report: () => ({ title: "t" }) };
    expect(probeAndToggle(PRODUCT.pageFlag)).toBe("toggled");
    expect(toggle).toHaveBeenCalledOnce();
    expect(readReport(PRODUCT.pageFlag)).toEqual({ title: "t" });
    const retire = vi.fn();
    w[PRODUCT.pageFlag] = { toggle, alive: () => false, retire };
    expect(probeAndToggle(PRODUCT.pageFlag)).toBe("absent");
    expect(retire).toHaveBeenCalledOnce();
    expect(w[PRODUCT.pageFlag]).toBeUndefined();
  });
});

describe("activateTab", () => {
  type Call = { func?: unknown; files?: string[] };
  function fakeChrome(opts: { url?: string; status?: string; probe?: string; fail?: string; tabMissing?: boolean }) {
    const calls: Call[] = [];
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: {
        get: async () => {
          if (opts.tabMissing) throw new Error("No tab with id: 5");
          return { url: opts.url, status: opts.status ?? "complete" };
        }
      },
      extension: { isAllowedFileSchemeAccess: async () => false },
      scripting: {
        executeScript: async (inj: Call) => {
          calls.push(inj);
          if (opts.fail) throw new Error(opts.fail);
          if (inj.func === probeAndToggle) return [{ result: opts.probe ?? "absent" }];
          if (inj.func === readReport) return [{ result: { title: "T", host: "h", lang: "", headings: 0, links: 0, images: 0 } }];
          return [{}];
        }
      }
    };
    return calls;
  }

  it("injects once, then toggles", async () => {
    const calls = fakeChrome({ url: "https://example.com/" });
    const r = await activateTab(5);
    expect(r.kind).toBe("injected");
    expect(calls.some((c) => c.files?.includes("page.js"))).toBe(true);
    const calls2 = fakeChrome({ url: "https://example.com/", probe: "toggled" });
    expect((await activateTab(5)).kind).toBe("toggled");
    expect(calls2.some((c) => c.files)).toBe(false);
  });

  it("explains restricted pages without trying to inject", async () => {
    const calls = fakeChrome({ url: "chrome://settings/" });
    expect(await activateTab(6)).toEqual({ kind: "unavailable", reason: "restricted" });
    expect(calls).toEqual([]);
  });

  it("classifies a missing grant, a closed tab and a navigation", async () => {
    fakeChrome({ fail: "Cannot access contents of the page. Extension manifest must request permission to access the respective host." });
    expect(await activateTab(7)).toMatchObject({ kind: "unavailable", reason: "no-access" });
    fakeChrome({ tabMissing: true });
    expect((await activateTab(8)).kind).toBe("gone");
    fakeChrome({ fail: "Frame with ID 0 was removed." });
    expect((await activateTab(9)).kind).toBe("gone");
  });

  it("queues activations per tab", async () => {
    const order: string[] = [];
    fakeChrome({ url: "https://example.com/" });
    await Promise.all([activateTab(10).then(() => order.push("a")), activateTab(10).then(() => order.push("b"))]);
    expect(order).toEqual(["a", "b"]);
  });
});
