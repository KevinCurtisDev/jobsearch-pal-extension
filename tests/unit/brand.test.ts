import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRAND_NAME, PLATFORM_DOMAIN, STORE_TITLE } from "../../src/core/brand";
import { PRODUCT } from "../../src/shared/product";
import { brandHits, checkLocale, loadMessages, resolveMessages } from "../../scripts/dist-rules.ts";

const config = JSON.parse(readFileSync("extension.config.json", "utf8")) as { name: string };
const manifest = JSON.parse(readFileSync("src/manifest.json", "utf8")) as Record<string, unknown>;
const locale = loadMessages(JSON.parse(readFileSync("_locales/en/messages.json", "utf8")));

describe("brand module (ADR-011)", () => {
  it("exports the brand name, store title and domain", () => {
    expect(BRAND_NAME).toBe(PRODUCT.name);
    expect(BRAND_NAME).toBe(config.name);
    expect(STORE_TITLE).toBe("JobSearch Pal: Job Application Tracker");
    expect(PLATFORM_DOMAIN).toBe("jobsearchpal.com");
  });

  it("matches the localized extension name", () => {
    expect(locale.errors).toEqual([]);
    expect(locale.messages.extname).toBe(STORE_TITLE);
    expect(locale.messages.extshortname).toBeTruthy();
    expect(locale.messages.extdescription).toBeTruthy();
  });
});

describe("locales", () => {
  it("the shipped manifest is localized and resolves", () => {
    expect(checkLocale(manifest, locale.messages, config.name)).toEqual([]);
    const { manifest: resolved, errors } = resolveMessages(manifest, locale.messages);
    expect(errors).toEqual([]);
    expect(resolved.name).toBe(STORE_TITLE);
    expect((resolved.action as { default_title: string }).default_title).toBe(STORE_TITLE);
  });

  it("matches keys case-insensitively and reports unknown keys", () => {
    const { manifest: m, errors } = resolveMessages({ name: "__MSG_EXTNAME__", short_name: "__MSG_nope__" }, { extname: "A" });
    expect(m.name).toBe("A");
    expect(errors).toEqual(['manifest uses __MSG_nope__ but messages.json has no "nope"']);
  });

  it("rejects a missing default_locale, literal names and an extName without the config name", () => {
    const errors = checkLocale({ ...manifest, default_locale: undefined, name: "Literal" }, { extname: "Other: Tracker" }, config.name);
    expect(errors).toEqual([
      'default_locale must be "en"',
      'manifest name must be "__MSG_extName__"',
      `extName must start with "${config.name}" (extension.config.json name)`
    ]);
  });

  it("rejects malformed messages.json", () => {
    expect(loadMessages([]).errors).toEqual(["messages.json must be an object"]);
    expect(loadMessages({ extName: { description: "x" } }).errors).toEqual(['messages.json "extName" needs a string "message"']);
  });
});

describe("G6 brand scan", () => {
  it("finds old names case-insensitively in the bad fixture", () => {
    const bad = readFileSync("tests/fixtures/brand/bad-source.txt", "utf8");
    expect(brandHits(bad)).toEqual(['old name "JobPilot" at 2:16', 'old name "hearback" at 3:8', 'old name "OFFERLIGHT" at 3:29']);
  });

  it("passes the shipped brand files", () => {
    expect(brandHits(readFileSync("_locales/en/messages.json", "utf8"))).toEqual([]);
    expect(brandHits(readFileSync("src/core/brand.ts", "utf8"))).toEqual([]);
  });
});
