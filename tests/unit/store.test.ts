import { beforeEach, describe, expect, it } from "vitest";
import { installFakeStorage } from "./fake-storage";
import { defineKey, read, remove, watch, write } from "../../src/storage/store";

type Counter = { n: number };
const parseCounter = (v: unknown): Counter | null => (typeof v === "object" && v !== null && typeof (v as Counter).n === "number" ? { n: (v as Counter).n } : null);

describe("storage module", () => {
  let fake: ReturnType<typeof installFakeStorage>;
  beforeEach(() => {
    fake = installFakeStorage();
  });

  it("returns the fallback for missing or invalid data", async () => {
    const k = defineKey("local", "counter", parseCounter, { n: 0 });
    expect(await read(k)).toEqual({ n: 0 });
    fake.local.data.set("counter", "corrupt");
    expect(await read(k)).toEqual({ n: 0 });
  });

  it("round-trips valid values and removes them", async () => {
    const k = defineKey("sync", "counter", parseCounter, { n: 0 });
    await write(k, { n: 3 });
    expect(await read(k)).toEqual({ n: 3 });
    await remove(k);
    expect(await read(k)).toEqual({ n: 0 });
  });

  it("refuses invalid values and oversize sync items", async () => {
    const k = defineKey("sync", "counter", parseCounter, { n: 0 });
    await expect(write(k, { n: "x" } as unknown as Counter)).rejects.toThrow(/invalid value/);
    const big = defineKey("sync", "big", (v) => (typeof v === "string" ? v : null), "");
    await expect(write(big, "x".repeat(9000))).rejects.toThrow(/8192/);
    const local = defineKey("local", "big", (v) => (typeof v === "string" ? v : null), "");
    await expect(write(local, "x".repeat(9000))).resolves.toBeUndefined();
  });

  it("watches changes with validated values", async () => {
    const k = defineKey("local", "counter", parseCounter, { n: 0 });
    const seen: Counter[] = [];
    const stop = watch(k, (v) => seen.push(v));
    await write(k, { n: 1 });
    await remove(k);
    stop();
    await write(k, { n: 2 });
    expect(seen).toEqual([{ n: 1 }, { n: 0 }]);
  });

  it("rejects unsafe key names", () => {
    expect(() => defineKey("local", "", parseCounter, { n: 0 })).toThrow();
    expect(() => defineKey("local", "a b", parseCounter, { n: 0 })).toThrow();
  });
});
