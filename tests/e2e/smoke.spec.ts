import { readFileSync } from "node:fs";
import { STORE_TITLE } from "../../src/core/brand";
import { expect, test } from "./fixtures";

const config = JSON.parse(readFileSync("extension.config.json", "utf8")) as { name: string; permissions: { permissions: string[]; hostPermissions: string[] } };

test("the service worker starts", async ({ sw }) => {
  const version = await sw.evaluate(() => chrome.runtime.getManifest().version);
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
});

test("Chrome grants exactly the permission budget, and no host access", async ({ sw, manifest }) => {
  // Chrome resolves __MSG_extName__ from _locales/en/messages.json.
  const { name } = await manifest();
  expect(name).toBe(STORE_TITLE);
  expect(name.startsWith(config.name)).toBe(true);
  const granted = await sw.evaluate(() => chrome.permissions.getAll());
  expect([...(granted.permissions ?? [])].sort()).toEqual([...config.permissions.permissions].sort());
  expect(granted.origins ?? []).toEqual(config.permissions.hostPermissions);
});
