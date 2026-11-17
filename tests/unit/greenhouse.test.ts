// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { loadFixture } from "./fixture-doc";
import { isGreenhouse, readGreenhouse } from "../../src/adapters/greenhouse";
import { captureDraft } from "../../src/adapters/index";
import { JobDraftSchema } from "../../src/core/model";

const AT = "2026-11-17T10:00:00.000Z";
const ID = "01JD0000000000000000000000";
const GH = new URL("https://job-boards.greenhouse.io/sampleorchard/jobs/1234567");


/** Classic layout built with createElement (no HTML strings). */
function classicDoc(): Document {
  const doc = document.implementation.createHTMLDocument("Job Application for Fixture Role");
  const header = doc.createElement("div");
  header.id = "header";
  const add = (parent: Element, tag: string, cls: string, text: string) => {
    const el = doc.createElement(tag);
    el.className = cls;
    el.textContent = text;
    parent.append(el);
    return el;
  };
  add(header, "h1", "app-title", "Fixture Role");
  add(header, "span", "company-name", "  at Classic Example Corp ");
  add(header, "div", "location", "Remote");
  const content = doc.createElement("div");
  content.id = "content";
  add(content, "p", "", "Classic description.");
  doc.body.append(header, content);
  return doc;
}

describe("isGreenhouse", () => {
  it("matches Greenhouse board hosts over https only", () => {
    for (const u of [
      "https://boards.greenhouse.io/x/jobs/1",
      "https://job-boards.greenhouse.io/x/jobs/1",
      "https://job-boards.eu.greenhouse.io/x/jobs/1",
    ]) expect(isGreenhouse(new URL(u))).toBe(true);
    for (const u of [
      "http://boards.greenhouse.io/x",
      "https://greenhouse.io/",
      "https://boards.greenhouse.io.evil.test/x",
      "https://evilboards.greenhouse.io.example/x",
      "https://example.com/careers?gh_jid=1",
    ]) expect(isGreenhouse(new URL(u))).toBe(false);
  });
});

describe("readGreenhouse (synthetic fixture, jsdom)", () => {
  it("reads title, company, location and description with adapter provenance", () => {
    const f = readGreenhouse(loadFixture("greenhouse.html"), GH, AT);
    expect(f?.title.value).toBe("Data Gardener");
    expect(f?.company?.value).toBe("Sample Orchard Co");
    expect(f?.location?.value).toBe("Exampleton, Nowhere");
    expect(f?.description?.value).toBe("We grow tidy datasets.\nYou will\n• Prune pipelines\n• Water dashboards\nBenefits & perks.");
    expect(f?.description?.value).not.toContain("tracking");
    expect(f?.pay).toBeUndefined();
    for (const field of Object.values(f ?? {})) {
      expect(field.source).toBe("adapter");
      expect(field.at).toBe(AT);
      expect(field.confidence).toBeGreaterThan(0);
      expect(field.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("reads the classic layout and strips the 'at' before the company", () => {
    const f = readGreenhouse(classicDoc(), new URL("https://boards.greenhouse.io/classic/jobs/9"), AT);
    expect(f?.title.value).toBe("Fixture Role");
    expect(f?.company?.value).toBe("Classic Example Corp");
    expect(f?.location?.value).toBe("Remote");
    expect(f?.description?.value).toBe("Classic description.");
  });

  it("returns null off Greenhouse or without a title, and never changes the page", () => {
    const doc = loadFixture("greenhouse.html");
    const before = doc.documentElement.textContent;
    expect(readGreenhouse(doc, new URL("https://example.com/jobs/1"), AT)).toBeNull();
    readGreenhouse(doc, GH, AT);
    expect(doc.documentElement.textContent).toBe(before);
    expect(readGreenhouse(document.implementation.createHTMLDocument("x"), GH, AT)).toBeNull();
  });

  it("captureDraft uses the adapter and JSON-LD wins where both have a field", () => {
    const doc = loadFixture("greenhouse.html");
    const d = captureDraft(doc, GH.href, { id: ID, now: AT });
    expect(JobDraftSchema.safeParse(d).success).toBe(true);
    expect(d?.title).toEqual({ value: "Data Gardener", source: "adapter", confidence: 0.85, at: AT });
    expect(d?.url.source).toBe("adapter");

    const script = doc.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({ "@type": "JobPosting", title: "Data Gardener II", hiringOrganization: "Orchard" });
    doc.head.append(script);
    const merged = captureDraft(doc, GH.href, { id: ID, now: AT });
    expect(merged?.title.value).toBe("Data Gardener II");
    expect(merged?.title.source).toBe("jsonld");
    expect(merged?.company?.value).toBe("Orchard");
    expect(merged?.location?.source).toBe("adapter");
    expect(merged?.description?.source).toBe("adapter");
  });
});
