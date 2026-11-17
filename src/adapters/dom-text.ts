// Plain text from a DOM subtree, keeping paragraph and list structure. Reads only: never changes the
// page, never reads HTML strings (sinks are banned). Script/style content is skipped.
import { tidyText } from "../core/jsonld";

const BLOCK = new Set([
  "P", "DIV", "BR", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "TR", "TABLE", "SECTION", "ARTICLE",
  "HEADER", "FOOTER", "BLOCKQUOTE", "PRE", "HR", "DD", "DT", "DL",
]);
const SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "IFRAME", "SVG", "BUTTON", "FORM", "INPUT", "SELECT", "TEXTAREA"]);
const MAX_NODES = 50_000;

export function textOf(root: Element): string {
  let out = "";
  let seen = 0;
  const walk = (node: Node): void => {
    if (++seen > MAX_NODES) return;
    if (node.nodeType === 3) {
      out += node.nodeValue ?? "";
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = (node as Element).tagName.toUpperCase();
    if (SKIP.has(tag)) return;
    if (tag === "LI") out += "\n• ";
    else if (BLOCK.has(tag)) out += "\n";
    for (const child of Array.from(node.childNodes)) walk(child);
    if (BLOCK.has(tag)) out += "\n";
  };
  walk(root);
  return tidyText(out);
}

/** One-line text of the first element matching any selector, or undefined. */
export function lineOf(doc: ParentNode, selectors: readonly string[]): string | undefined {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const s = el?.textContent?.replace(/\s+/g, " ").trim();
    if (s) return s;
  }
  return undefined;
}
