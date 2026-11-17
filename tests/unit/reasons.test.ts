import { describe, expect, it } from "vitest";
import { explain, isX3Host, isX3Url, REASONS, reasonFromError, reasonFromUrl } from "../../src/page-inject/reasons";

describe("reasons", () => {
  it("classifies URLs before injecting", () => {
    expect(reasonFromUrl("chrome://extensions/", true)).toBe("restricted");
    expect(reasonFromUrl("https://chromewebstore.google.com/detail/x", true)).toBe("restricted");
    expect(reasonFromUrl("file:///tmp/a.html", false)).toBe("file");
    expect(reasonFromUrl("file:///tmp/a.html", true)).toBeNull();
    expect(reasonFromUrl("https://example.com/doc.PDF?x=1", true)).toBe("pdf");
    expect(reasonFromUrl("https://example.com/", true)).toBeNull();
    expect(reasonFromUrl(undefined, true)).toBeNull();
  });

  it("classifies injection errors", () => {
    expect(reasonFromError("Cannot access a chrome:// URL", undefined, true)).toBe("restricted");
    expect(reasonFromError("The extensions gallery cannot be scripted.", undefined, true)).toBe("restricted");
    expect(reasonFromError("Cannot access contents of the page. Extension manifest must request permission to access the respective host.", undefined, true)).toBe("no-access");
    expect(reasonFromError("Cannot access contents of url \"file:///x\"", undefined, false)).toBe("file");
    expect(reasonFromError("Something else", "https://example.com/", true)).toBe("blocked");
  });

  it("has a user-facing explanation for every reason", () => {
    for (const r of REASONS) expect(explain(r).length).toBeGreaterThan(20);
  });

  it("matches X3 hosts by registrable domain (SPEC F3)", () => {
    for (const h of ["linkedin.com", "www.linkedin.com", "LinkedIn.com", "www.linkedin.com.", "ie.indeed.com", "indeed.com", "uk.indeed.com", "glassdoor.com", "glassdoor.co.uk", "www.glassdoor.co.uk", "glassdoor.de", "www.glassdoor.com.au"]) {
      expect(isX3Host(h), h).toBe(true);
    }
    for (const h of ["notlinkedin.com", "linkedin.com.example.org", "indeed.com.evil.test", "glassdoor.com.evil.test", "myindeed.com", "glassdoors.com", "linkedin.example.org", "example.com", "linkedin", "", "linkedin..com"]) {
      expect(isX3Host(h), h).toBe(false);
    }
  });

  it("refuses X3 URLs before anything else", () => {
    expect(isX3Url("https://www.linkedin.com/jobs/view/1")).toBe(true);
    expect(isX3Url("http://ie.indeed.com/viewjob?jk=1")).toBe(true);
    expect(isX3Url("https://linkedin.com.example.org/x")).toBe(false);
    expect(isX3Url("not a url")).toBe(false);
    expect(isX3Url(undefined)).toBe(false);
    expect(reasonFromUrl("https://www.glassdoor.co.uk/job-listing/x.htm", true)).toBe("x3");
    expect(reasonFromUrl("https://www.linkedin.com/doc.pdf", true)).toBe("x3");
    expect(reasonFromUrl("https://notlinkedin.com/", true)).toBeNull();
  });
});
