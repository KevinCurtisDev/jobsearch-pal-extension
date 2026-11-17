import { describe, expect, it } from "vitest";
import { explain, REASONS, reasonFromError, reasonFromUrl } from "../../src/page-inject/reasons";

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
});
