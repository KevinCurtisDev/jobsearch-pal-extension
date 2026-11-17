import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadNetworkAllowlist, networkHits, referencedFiles } from "../../scripts/dist-rules.ts";

const bad = readFileSync("tests/fixtures/network/bad-bundle.js", "utf8");

describe("G1 network audit", () => {
  it("reports one message per hit in the bad fixture", () => {
    const hits = networkHits(bad, new Set());
    expect(hits).toEqual([
      "fetch( at 2:1",
      "XMLHttpRequest at 3:15",
      "WebSocket at 4:16",
      "EventSource at 5:16",
      "sendBeacon at 6:11",
      "remote import() at 7:1",
      "external URL https://cdn.example/mod.js at 7:9",
      "external URL http://tracker.example/pixel at 8:12"
    ]);
  });

  it("passes a clean bundle and allowlisted URLs", () => {
    const clean = 'const s = "https://chromewebstore.google.com"; chrome.runtime.sendMessage({ type: "x" }); const prefetch = 1;';
    expect(networkHits(clean, new Set(["https://chromewebstore.google.com"]))).toEqual([]);
  });

  it("matches allowlist entries exactly, not as prefixes", () => {
    const text = '"https://chromewebstore.google.com/evil"';
    expect(networkHits(text, new Set(["https://chromewebstore.google.com"]))).toEqual([
      "external URL https://chromewebstore.google.com/evil at 1:2"
    ]);
  });

  it("loads the shipped allowlist", () => {
    const { allowed, errors } = loadNetworkAllowlist(JSON.parse(readFileSync("scripts/network-allow.json", "utf8")));
    expect(errors).toEqual([]);
    expect(allowed.size).toBeGreaterThan(0);
  });

  it("rejects wildcard, pattern, unexplained and malformed entries", () => {
    const { allowed, errors } = loadNetworkAllowlist({
      entries: [
        { url: "https://*.example.com", reason: "wild" },
        { url: "https://example.com/.*", reason: "regex" },
        { url: "/^https:\\/\\/a\\.com/", reason: "regex literal" },
        { url: "https://ok.example", reason: "" },
        { url: "ftp://ok.example", reason: "scheme" },
        { url: "https://ok.example", reason: "fine" },
        "https://string.example"
      ]
    });
    expect(errors).toHaveLength(6);
    expect([...allowed]).toEqual(["https://ok.example"]);
    expect(loadNetworkAllowlist([]).errors).toEqual(["network-allow.json must be an object with an \"entries\" array"]);
  });
});

describe("G4 referenced files", () => {
  it("includes side_panel.default_path", () => {
    expect(referencedFiles({ side_panel: { default_path: "panel/x.html" } })).toEqual(["panel/x.html"]);
    expect(referencedFiles({ side_panel: { default_path: 3 } })).toEqual([]);
  });
});
