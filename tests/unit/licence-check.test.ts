import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALLOWED_LICENCES, inexactVersions, licenceProblems } from "../../scripts/licence-check.ts";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as Record<string, unknown>;

describe("exact dependency versions", () => {
  it("package.json pins every dependency and devDependency exactly", () => {
    expect(inexactVersions(pkg)).toEqual([]);
  });

  it("pins dexie 4.4.7 and zod 4.6.7 as the runtime dependencies", () => {
    expect(pkg.dependencies).toEqual({ dexie: "4.4.7", zod: "4.6.7" });
  });

  it("reports ranges, tags and URLs", () => {
    const bad = { dependencies: { a: "^1.0.0", b: "~2.0.0", c: "1.2.3", d: "latest", e: "github:x/y" }, devDependencies: { f: ">=1", g: "1.0.0-beta.1" } };
    expect(inexactVersions(bad)).toEqual(["dependencies.a: ^1.0.0", "dependencies.b: ~2.0.0", "dependencies.d: latest", "dependencies.e: github:x/y", "devDependencies.f: >=1"]);
  });
});

describe("licence check", () => {
  it("allows exactly the ADR-014 licences", () => {
    expect([...ALLOWED_LICENCES].sort()).toEqual(["0BSD", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MIT"]);
  });

  it("passes the real lockfile", () => {
    expect(licenceProblems(JSON.parse(readFileSync("package-lock.json", "utf8")))).toEqual([]);
  });

  it("checks production packages only and fails on other or missing licences", () => {
    const lock = {
      packages: {
        "": { name: "root", license: "UNLICENSED" },
        "node_modules/ok": { version: "1.0.0", license: "MIT" },
        "node_modules/gpl": { version: "1.0.0", license: "GPL-3.0" },
        "node_modules/none": { version: "1.0.0" },
        "node_modules/either": { version: "1.0.0", license: "(MIT OR GPL-3.0)" },
        "node_modules/dev-gpl": { version: "1.0.0", license: "GPL-3.0", dev: true },
        "node_modules/peer-gpl": { version: "1.0.0", license: "GPL-3.0", devOptional: true }
      }
    };
    expect(licenceProblems(lock)).toEqual(["gpl@1.0.0: GPL-3.0", "none@1.0.0: no licence", "either@1.0.0: (MIT OR GPL-3.0)"]);
  });

  it("fails on a lockfile it cannot read", () => {
    expect(licenceProblems(null)).toEqual(["package-lock.json has no packages map"]);
  });
});
