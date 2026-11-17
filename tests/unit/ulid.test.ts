import { describe, expect, it } from "vitest";
import { createUlid, isUlid, ulidTime, ULID_LENGTH } from "../../src/core/ulid";

const fixed = (byte: number) => (b: Uint8Array) => b.fill(byte);

describe("ULID (X11)", () => {
  it("encodes time and randomness in 26 Crockford base32 chars", () => {
    const id = createUlid({ now: () => 1_469_918_176_385, random: fixed(0) })();
    expect(id).toHaveLength(ULID_LENGTH);
    expect(id).toBe("01ARYZ6S41" + "0".repeat(16));
    expect(isUlid(id)).toBe(true);
    expect(ulidTime(id)).toBe(1_469_918_176_385);
  });

  it("uses all 80 random bits", () => {
    const id = createUlid({ now: () => 0, random: fixed(0xff) })();
    expect(id).toBe("0".repeat(10) + "Z".repeat(16));
  });

  it("sorts by time across milliseconds", () => {
    let t = 1000;
    const next = createUlid({ now: () => t, random: (b) => b.map(() => Math.floor(Math.random() * 256)) });
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      t += 1 + (i % 3);
      ids.push(next());
    }
    expect([...ids].sort()).toEqual(ids);
  });

  it("is monotonic within one millisecond and when the clock goes back", () => {
    let t = 5000;
    const next = createUlid({ now: () => t, random: fixed(0x7f) });
    const a = next();
    const b = next();
    t = 4000;
    const c = next();
    expect(a < b && b < c).toBe(true);
    expect(ulidTime(c)).toBe(5000);
    expect(b.slice(10)).not.toBe(a.slice(10));
  });

  it("throws when the random part overflows in one millisecond", () => {
    const next = createUlid({ now: () => 1, random: fixed(0xff) });
    next();
    expect(() => next()).toThrow(RangeError);
  });

  it("rejects bad times and bad random sources", () => {
    expect(() => createUlid({ now: () => -1, random: fixed(0) })()).toThrow(RangeError);
    expect(() => createUlid({ now: () => 2 ** 48, random: fixed(0) })()).toThrow(RangeError);
    expect(() => createUlid({ now: () => 1, random: () => new Uint8Array(3) })()).toThrow(TypeError);
  });

  it("isUlid rejects malformed ids", () => {
    for (const v of [null, 1, "", "01ARYZ6S41", "01ARYZ6S410000000000000000X", "01ARYZ6S41000000000000000I", "81ARYZ6S410000000000000000", "01aryz6s410000000000000000"]) {
      expect(isUlid(v)).toBe(false);
    }
    expect(() => ulidTime("nope")).toThrow(TypeError);
  });
});
