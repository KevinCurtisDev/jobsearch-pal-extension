import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bannedCode, checkManifest, referencedFiles } from "../../scripts/dist-rules.ts";

const manifest = JSON.parse(readFileSync("src/manifest.json", "utf8")) as Record<string, unknown>;
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

  it("lists the files the manifest references", () => {
    expect(referencedFiles(manifest)).toContain("background.js");
  });

  it("detects remote or dynamic code", () => {
    expect(bannedCode("const x = eval('1')")).toEqual(["eval("]);
    expect(bannedCode('importScripts("https://cdn.example/x.js")')).toEqual(["remote importScripts"]);
    expect(bannedCode("const evaluate = 1;")).toEqual([]);
  });
});
