import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

const config = JSON.parse(readFileSync("extension.config.json", "utf8")) as { name: string; permissions: { permissions: string[]; hostPermissions: string[] } };

test("the service worker starts", async ({ sw }) => {
  const version = await sw.evaluate(() => chrome.runtime.getManifest().version);
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
});

test("Chrome grants exactly the permission budget, and no host access", async ({ sw, manifest }) => {
  expect((await manifest()).name).toBe(config.name);
  const granted = await sw.evaluate(() => chrome.permissions.getAll());
  expect([...(granted.permissions ?? [])].sort()).toEqual([...config.permissions.permissions].sort());
  expect(granted.origins ?? []).toEqual(config.permissions.hostPermissions);
});
