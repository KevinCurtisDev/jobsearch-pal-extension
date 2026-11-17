import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// G3: the src/core ESLint block rejects browser globals and browser-side imports.
const eslint = new ESLint({ cwd: process.cwd() });

async function lint(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages ?? [];
}

describe("src/core purity gate", () => {
  it("rejects chrome.* in src/core", async () => {
    const messages = await lint('export const get = () => chrome.storage.local.get("x");\n', "src/core/fixture.ts");
    expect(messages.some((m) => m.ruleId === "no-restricted-globals" && /chrome/.test(m.message))).toBe(true);
  });

  it("rejects window and document in src/core", async () => {
    const messages = await lint("export const t = () => [window.name, document.title];\n", "src/core/fixture.ts");
    const hits = messages.filter((m) => m.ruleId === "no-restricted-globals");
    expect(hits.length).toBe(2);
  });

  it("rejects imports of browser-side modules in src/core", async () => {
    const messages = await lint('import { get } from "../storage/store.ts";\nexport { get };\n', "src/core/fixture.ts");
    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("keeps the base bans in src/core", async () => {
    const messages = await lint("export const p = new DOMParser();\n", "src/core/fixture.ts");
    expect(messages.some((m) => m.ruleId === "no-restricted-globals")).toBe(true);
  });

  it("allows chrome outside src/core", async () => {
    const messages = await lint('export const get = () => chrome.storage.local.get("x");\n', "src/background/fixture.ts");
    expect(messages.filter((m) => m.severity === 2)).toEqual([]);
  });

  it("passes plain TypeScript in src/core", async () => {
    const messages = await lint("export const add = (a: number, b: number): number => a + b;\n", "src/core/fixture.ts");
    expect(messages).toEqual([]);
  });
});
