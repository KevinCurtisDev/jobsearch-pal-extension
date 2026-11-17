import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tokensToCss } from "../../scripts/tokens-css.ts";

const tokens = JSON.parse(readFileSync("design/tokens.json", "utf8")) as unknown;

describe("tokens.css generator", () => {
  it("turns design/tokens.json into :root custom properties", () => {
    const css = tokensToCss(tokens);
    expect(css.startsWith(":root {")).toBe(true);
    expect(css).toContain("  --color-ink: #1D1D1F;");
    expect(css).toContain("  --color-status-positive-text: #146C2E;");
    expect(css).toContain("  --font-body-size: 17px;");
    expect(css).toContain("  --font-body-weight: 400;");
    expect(css).toContain("  --font-body-line-height: 1.5;");
    expect(css).toContain("  --space-4: 16px;");
    expect(css).toContain("  --size-touch-target: 44px;");
    expect(css).toContain("  --shadow-paper: 0 1px 3px rgba(0,0,0,0.08);");
  });

  it("drops descriptions and metadata", () => {
    const css = tokensToCss(tokens);
    expect(css).not.toMatch(/description|role|contrast|Primary text/i);
  });

  it("rejects values that could break out of a declaration", () => {
    expect(() => tokensToCss({ color: { x: { value: "red; } body { display: none" } } })).toThrow(/unsafe/);
    expect(() => tokensToCss({ color: { x: { value: true } } })).toThrow(/color.x/);
    expect(() => tokensToCss([])).toThrow(/object/);
  });
});

describe("side panel and UI source", () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  it("has no hex colour values (styles come only from token variables)", () => {
    const files = ["src/sidepanel", "src/ui"].flatMap(walk).concat("public/sidepanel.html");
    const hits = files.filter((f) => /#[0-9a-f]{3,8}\b/i.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
