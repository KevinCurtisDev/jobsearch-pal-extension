import { describe, expect, it } from "vitest";
import { errorText, isIntInRange, isOneOf, isRecord, isShortString } from "../../src/shared/validate";

describe("validators", () => {
  it("isRecord", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });
  it("isShortString", () => {
    expect(isShortString("abc", 3)).toBe(true);
    expect(isShortString("abcd", 3)).toBe(false);
    expect(isShortString(3)).toBe(false);
  });
  it("isIntInRange", () => {
    expect(isIntInRange(5, 0, 10)).toBe(true);
    expect(isIntInRange(5.5, 0, 10)).toBe(false);
    expect(isIntInRange(11, 0, 10)).toBe(false);
  });
  it("isOneOf", () => {
    expect(isOneOf("a", ["a", "b"] as const)).toBe(true);
    expect(isOneOf("c", ["a", "b"] as const)).toBe(false);
  });
  it("errorText", () => {
    expect(errorText(new Error("boom"))).toBe("boom");
    expect(errorText("x".repeat(300)).length).toBe(200);
  });
});
