// Loads a synthetic page fixture from tests/fixtures/pages into its own jsdom document.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";

export function loadFixture(name: string): Document {
  const html = readFileSync(join(process.cwd(), "tests/fixtures/pages", name), "utf8");
  return new JSDOM(html).window.document;
}
