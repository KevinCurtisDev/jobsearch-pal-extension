import { describe, expect, it } from "vitest";
import { draftFromForm, formValues } from "../../src/sidepanel/review";
import { JobDraftSchema, LIMITS, type JobDraft } from "../../src/core/model";

const AT = "2026-11-17T10:00:00.000Z";
const NOW = "2026-11-17T10:05:00.000Z";
const f = <T>(value: T, source: "jsonld" | "manual" = "jsonld", confidence = 0.9) => ({ value, source, confidence, at: AT });
const pay = f({ currency: "GBP", period: "year" as const, minMinor: 100, maxMinor: 200 });
const full: JobDraft = JobDraftSchema.parse({ id: "01JD0000000000000000000000", capturedAt: AT, url: f("https://jobs.example.com/1"), title: f("Engineer"), company: f("Acme"), location: f("Leeds"), description: f("Build things."), pay });
const urlOnly: JobDraft = JobDraftSchema.parse({ id: "01JD0000000000000000000001", capturedAt: AT, url: f("https://www.linkedin.com/jobs/view/123", "manual", 1), title: f("Data Gardener | LinkedIn", "manual", 0.4) });
const manual = (value: string) => ({ value, source: "manual", confidence: 1, at: NOW });

describe("draftFromForm (F4)", () => {
  it("returns the draft unchanged when nothing was edited", () => {
    expect(draftFromForm(full, formValues(full), NOW)).toEqual({ ok: true, draft: full });
  });

  it("marks edited fields as manual, keeps the rest and the draft id", () => {
    const r = draftFromForm(full, { ...formValues(full), title: "  Senior Engineer ", company: "Acme" }, NOW);
    expect(r).toEqual({ ok: true, draft: { ...full, title: manual("Senior Engineer") } });
  });

  it("adds pasted text to a URL-only draft", () => {
    const r = draftFromForm(urlOnly, { ...formValues(urlOnly), title: "Data Gardener", company: "Sample Orchard Co", description: "Water the data.\n\nLine two." }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft).toEqual({ ...urlOnly, title: manual("Data Gardener"), company: manual("Sample Orchard Co"), description: manual("Water the data.\n\nLine two.") });
    expect(JobDraftSchema.parse(r.draft)).toEqual(r.draft);
  });

  it("drops cleared optional fields", () => {
    const r = draftFromForm(full, { ...formValues(full), company: " ", description: "" }, NOW);
    expect(r.ok && Object.keys(r.draft).sort()).toEqual(["capturedAt", "id", "location", "pay", "title", "url"]);
  });

  it("requires a title and an http(s) URL", () => {
    expect(draftFromForm(full, { ...formValues(full), title: "", url: "" }, NOW)).toEqual({ ok: false, errors: { title: "Enter a job title.", url: "Enter the job post's address." } });
    for (const url of ["javascript:alert(1)", "data:text/html,x", "jobs.example.com/1", "ftp://x.test/"]) {
      const r = draftFromForm(full, { ...formValues(full), url }, NOW);
      expect(r.ok ? null : Object.keys(r.errors)).toEqual(["url"]);
    }
  });

  it("reports every invalid field at once", () => {
    const r = draftFromForm(full, { ...formValues(full), title: "", url: "javascript:alert(1)" }, NOW);
    expect(r).toEqual({ ok: false, errors: { title: "Enter a job title.", url: "Enter the full address from the browser bar, starting with https or http." } });
  });

  it("rejects over-long text with a message on that field", () => {
    const r = draftFromForm(full, { ...formValues(full), description: "x".repeat(LIMITS.description + 1) }, NOW);
    expect(r.ok ? null : r.errors).toEqual({ description: "Use 50,000 characters or fewer." });
  });
});
