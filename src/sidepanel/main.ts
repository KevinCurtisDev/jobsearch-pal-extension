// Side panel shell (SPEC §3 F1, ADR-012): brand name and an empty state. DOM is built with
// createElement + textContent only; styles come from token variables (dist/tokens.css, src/ui/tokens.css).
import { BRAND_NAME } from "../core/brand";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderPanel(root: HTMLElement): void {
  const header = el("header", "panel-header");
  header.append(el("h1", "panel-title", BRAND_NAME));

  const empty = el("section", "empty");
  empty.setAttribute("aria-labelledby", "empty-title");
  const title = el("h2", "empty-title", "No saved jobs yet");
  title.id = "empty-title";
  empty.append(title, el("p", "empty-text", "Jobs you save will be listed here, with their status and notes."));

  const main = el("main", "panel");
  main.append(header, empty);
  root.replaceChildren(main);
}

document.title = BRAND_NAME;
renderPanel(document.getElementById("app") ?? document.body);
