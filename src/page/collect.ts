// Reads facts from the page. Read-only: never changes the page. Replace with your product's logic.
import type { PageReport } from "../page-inject/report";

export function collectReport(doc: Document, loc: { host: string }): PageReport {
  return {
    title: (doc.title || "").slice(0, 300),
    host: loc.host.slice(0, 255),
    lang: (doc.documentElement.getAttribute("lang") ?? "").slice(0, 35),
    headings: doc.querySelectorAll("h1, h2, h3, h4, h5, h6").length,
    links: doc.querySelectorAll("a[href]").length,
    images: doc.images.length
  };
}
