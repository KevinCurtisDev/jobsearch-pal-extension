import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bannedCode, checkManifest, loadMessages, referencedFiles, resolveMessages } from "../../scripts/dist-rules.ts";

const raw = JSON.parse(readFileSync("src/manifest.json", "utf8")) as Record<string, unknown>;
// check-dist resolves __MSG_*__ placeholders before the length checks; do the same here.
const manifest = resolveMessages(raw, loadMessages(JSON.parse(readFileSync("_locales/en/messages.json", "utf8"))).messages).manifest;
const config = JSON.parse(readFileSync("extension.config.json", "utf8")) as { permissions: { permissions: string[]; hostPermissions: string[] } };
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

describe("manifest", () => {
  it("matches the permission budget in extension.config.json", () => {
    expect(checkManifest(manifest, config.permissions, pkg.version)).toEqual([]);
  });

  it("rejects any permission outside the budget", () => {
    const wider = { ...manifest, permissions: [...((manifest.permissions as string[]) ?? []), "tabs"] };
    expect(checkManifest(wider, config.permissions, pkg.version).join()).toMatch(/permissions must be exactly/);
    const hosts = { ...manifest, host_permissions: ["<all_urls>"] };
    expect(checkManifest(hosts, config.permissions, pkg.version).join()).toMatch(/host_permissions/);
    const cs = { ...manifest, content_scripts: [] };
    expect(checkManifest(cs, config.permissions, pkg.version).join()).toMatch(/content_scripts/);
  });

  it("requires the strict extension-page CSP and matching versions", () => {
    expect(checkManifest({ ...manifest, content_security_policy: {} }, config.permissions, pkg.version).join()).toMatch(/content_security_policy/);
    expect(checkManifest(manifest, config.permissions, "9.9.9").join()).toMatch(/version/);
  });

  it("applies the store length limits to the resolved strings", () => {
    expect(checkManifest({ ...manifest, name: "x".repeat(76) }, config.permissions, pkg.version).join()).toMatch(/75/);
    expect(checkManifest({ ...manifest, short_name: "x".repeat(13) }, config.permissions, pkg.version).join()).toMatch(/12/);
    expect(checkManifest({ ...manifest, description: "x".repeat(133) }, config.permissions, pkg.version).join()).toMatch(/132/);
  });

  it("lists the files the manifest references, including the side panel (G4)", () => {
    expect(referencedFiles(manifest)).toContain("background.js");
    expect(referencedFiles(manifest)).toContain("sidepanel.html");
  });

  it("has the six-permission budget (ADR-006), a side panel and no popup (ADR-012)", () => {
    expect([...(manifest.permissions as string[])].sort()).toEqual(["activeTab", "alarms", "notifications", "scripting", "sidePanel", "storage"]);
    expect([...config.permissions.permissions].sort()).toEqual([...(manifest.permissions as string[])].sort());
    expect((manifest.side_panel as { default_path?: string }).default_path).toBe("sidepanel.html");
    expect(manifest.action).not.toHaveProperty("default_popup");
    const popup = { ...manifest, action: { ...(manifest.action as object), default_popup: "popup.html" } };
    expect(checkManifest(popup, config.permissions, pkg.version).join()).toMatch(/default_popup/);
  });

  it("detects remote or dynamic code", () => {
    expect(bannedCode("const x = eval('1')")).toEqual(["eval("]);
    expect(bannedCode('importScripts("https://cdn.example/x.js")')).toEqual(["remote importScripts"]);
    expect(bannedCode("const evaluate = 1;")).toEqual([]);
  });
});
