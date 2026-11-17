// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { loadFixture } from "./fixture-doc";
import { decodeEntities, extractJobPosting, htmlToText, isJobPostingType } from "../../src/core/jsonld";
import { captureDraft, jsonLdScripts } from "../../src/adapters/index";
import { JobDraftSchema } from "../../src/core/model";

const AT = "2026-11-17T10:00:00.000Z";
const ID = "01JD0000000000000000000000";
const posting = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ "@context": "https://schema.org", "@type": "JobPosting", title: "Engineer", ...extra });


describe("htmlToText", () => {
  it("drops tags and keeps paragraphs and list items as lines", () => {
    expect(htmlToText("<p>Hello <b>world</b></p><ul><li>One</li><li>Two</li></ul><p>End</p>")).toBe(
      "Hello world\n• One\n• Two\nEnd",
    );
  });
  it("removes script and style content and comments", () => {
    expect(htmlToText("a<script>alert(1)</script>b<style>p{}</style>c<!-- x -->d")).toBe("abcd");
  });
  it("unescapes double-escaped HTML", () => {
    expect(htmlToText("&lt;p&gt;Tom &amp;amp; Jerry&lt;/p&gt;")).toBe("Tom & Jerry");
  });
  it("decodes named and numeric entities and ignores invalid code points", () => {
    expect(decodeEntities("&eacute;x &#233; &#xE9; &mdash; &#0; &#xD800;")).toBe("&eacute;x é é —  ");
  });
  it("keeps a lone < and drops an unterminated tag", () => {
    expect(htmlToText("a < b")).toBe("a < b");
    expect(htmlToText("ok <div class=")).toBe("ok");
  });
  it("is fast on hostile input", () => {
    const evil = "<script>".repeat(50_000) + "<".repeat(100_000);
    const t0 = performance.now();
    htmlToText(evil);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

describe("extractJobPosting (F2)", () => {
  it("returns null for malformed JSON without throwing", () => {
    expect(extractJobPosting(['{"@type": "JobPosting", "title": "x",,}', "", "not json"], AT)).toBeNull();
  });
  it("returns null when no JobPosting or no title is present", () => {
    expect(extractJobPosting([JSON.stringify({ "@type": "Organization", name: "A" })], AT)).toBeNull();
    expect(extractJobPosting([JSON.stringify({ "@type": "JobPosting", title: "  " })], AT)).toBeNull();
    expect(extractJobPosting([JSON.stringify(null), "42", '"str"'], AT)).toBeNull();
  });
  it("finds postings in @graph, top-level arrays and nested nodes", () => {
    const graph = JSON.stringify({ "@graph": [{ "@type": "WebPage" }, JSON.parse(posting({ title: "In graph" }))] });
    expect(extractJobPosting([graph], AT)?.title.value).toBe("In graph");
    const arr = JSON.stringify([{ "@type": "Thing" }, JSON.parse(posting({ title: "In array" }))]);
    expect(extractJobPosting([arr], AT)?.title.value).toBe("In array");
    const nested = JSON.stringify({ "@type": "WebPage", mainEntity: JSON.parse(posting({ title: "Nested" })) });
    expect(extractJobPosting([nested], AT)?.title.value).toBe("Nested");
  });
  it("accepts type arrays, IRIs, prefixes and subtypes", () => {
    for (const t of [["Thing", "JobPosting"], "https://schema.org/JobPosting", "schema:JobPosting", "VolunteerJobPosting"]) {
      expect(isJobPostingType(t)).toBe(true);
    }
    for (const t of ["Job", "JobPostingX", 3, null, ["Organization"]]) expect(isJobPostingType(t)).toBe(false);
  });
  it("reads every field with source jsonld, a confidence and the capture time", () => {
    const f = extractJobPosting(
      [
        posting({
          title: "Engineer &amp; Tester",
          hiringOrganization: { name: "Acme" },
          jobLocation: [
            { address: { addressLocality: "Leeds", addressCountry: { name: "UK" } } },
            { address: "Remote-friendly York" },
          ],
          description: "<p>Line one</p><p>Line two</p>",
          baseSalary: { currency: "usd", value: { value: "52.50", unitText: "HOUR" } },
        }),
      ],
      AT,
    );
    expect(f).not.toBeNull();
    expect(f?.title.value).toBe("Engineer & Tester");
    expect(f?.company?.value).toBe("Acme");
    expect(f?.location?.value).toBe("Leeds, UK; Remote-friendly York");
    expect(f?.description?.value).toBe("Line one\nLine two");
    expect(f?.pay?.value).toEqual({ currency: "USD", period: "hour", minMinor: 5250, maxMinor: 5250 });
    for (const field of Object.values(f ?? {})) {
      expect(field.source).toBe("jsonld");
      expect(field.at).toBe(AT);
      expect(field.confidence).toBeGreaterThan(0);
      expect(field.confidence).toBeLessThanOrEqual(1);
    }
  });
  it("uses the currency's minor units and drops unusable pay", () => {
    const yen = extractJobPosting([posting({ baseSalary: { currency: "JPY", value: { minValue: 5e6, maxValue: 6e6, unitText: "YEAR" } } })], AT);
    expect(yen?.pay?.value).toEqual({ currency: "JPY", period: "year", minMinor: 5e6, maxMinor: 6e6 });
    for (const baseSalary of [
      { currency: "XXQ1", value: { value: 1, unitText: "YEAR" } },
      { currency: "USD", value: { value: 1, unitText: "FORTNIGHT" } },
      { currency: "USD", value: { value: -5, unitText: "YEAR" } },
      { currency: "USD", value: { minValue: 9, maxValue: 3, unitText: "YEAR" } },
      "lots",
    ]) {
      const f = extractJobPosting([posting({ baseSalary })], AT);
      expect(f?.title.value).toBe("Engineer");
      expect(f?.pay).toBeUndefined();
    }
  });
  it("omits fields over the model limits instead of failing", () => {
    const f = extractJobPosting([posting({ hiringOrganization: "x".repeat(201), description: "y".repeat(50_001) })], AT);
    expect(f?.title.value).toBe("Engineer");
    expect(f?.company).toBeUndefined();
    expect(f?.description).toBeUndefined();
    expect(extractJobPosting([posting({ title: "t".repeat(301) })], AT)).toBeNull();
  });
  it("marks telecommute jobs as remote and survives deep nesting", () => {
    expect(extractJobPosting([posting({ jobLocationType: "TELECOMMUTE" })], AT)?.location?.value).toBe("Remote");
    const deep = "[".repeat(5000) + posting() + "]".repeat(5000);
    expect(() => extractJobPosting([deep], AT)).not.toThrow();
    expect(extractJobPosting([deep], AT)).toBeNull(); // deeper than MAX_DEPTH: ignored
  });
  it("prefers the posting with the most fields", () => {
    const thin = posting({ title: "Thin" });
    const rich = posting({ title: "Rich", hiringOrganization: "Acme" });
    expect(extractJobPosting([thin, rich], AT)?.title.value).toBe("Rich");
  });
});

describe("captureDraft with JSON-LD fixtures", () => {
  const deps = { id: ID, now: AT };

  it("builds a valid draft from jsonld-valid.html", () => {
    const doc = loadFixture("jsonld-valid.html");
    expect(jsonLdScripts(doc)).toHaveLength(2);
    const d = captureDraft(doc, "https://careers.example.test/jobs/42", deps);
    expect(JobDraftSchema.safeParse(d).success).toBe(true);
    expect(d?.id).toBe(ID);
    expect(d?.url).toEqual({ value: "https://careers.example.test/jobs/42", source: "jsonld", confidence: 1, at: AT });
    expect(d?.title.value).toBe("Senior Widget Engineer");
    expect(d?.company?.value).toBe("Example Widgets Ltd");
    expect(d?.location?.value).toBe("Testville, TS, GB; Remote");
    expect(d?.description?.value).toBe("Build & test widgets.\n• Five years with gizmos\n• Kind to colleagues");
    expect(d?.pay?.value).toEqual({ currency: "GBP", period: "year", minMinor: 5_500_000, maxMinor: 6_500_050 });
  });

  it("gives a manual draft from URL and title for jsonld-malformed.html", () => {
    const doc = loadFixture("jsonld-malformed.html");
    const d = captureDraft(doc, "https://jobs.example.test/gadget", deps);
    expect(d).toEqual({
      id: ID,
      capturedAt: AT,
      url: { value: "https://jobs.example.test/gadget", source: "manual", confidence: 1, at: AT },
      title: { value: "Gadget Tester - Sample Gadgets", source: "manual", confidence: 0.4, at: AT },
    });
  });

  it("uses the host name when the tab has no title, and refuses non-http URLs", () => {
    const doc = document.implementation.createHTMLDocument("");
    expect(captureDraft(doc, "https://jobs.example.test/", deps)?.title.value).toBe("jobs.example.test");
    expect(captureDraft(doc, "file:///tmp/x.html", deps)).toBeNull();
    expect(captureDraft(doc, "javascript:alert(1)", deps)).toBeNull();
  });
});
