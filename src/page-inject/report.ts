// The data the injected page script reports back. Replace the fields with your product's own.
// Shared by the page script (which builds it) and the service worker (which validates it).
import { isIntInRange, isRecord, isShortString } from "../shared/validate";

export type PageReport = { title: string; host: string; lang: string; headings: number; links: number; images: number };

export function parseReport(v: unknown): PageReport | null {
  if (!isRecord(v)) return null;
  const { title, host, lang, headings, links, images } = v;
  if (!isShortString(title, 300) || !isShortString(host, 255) || !isShortString(lang, 35)) return null;
  for (const n of [headings, links, images]) if (!isIntInRange(n, 0, 1_000_000)) return null;
  return { title, host, lang, headings: headings as number, links: links as number, images: images as number };
}

export function reportRows(r: PageReport): [string, string][] {
  return [
    ["Title", r.title || "(none)"],
    ["Site", r.host || "(none)"],
    ["Language", r.lang || "(not set)"],
    ["Headings", String(r.headings)],
    ["Links", String(r.links)],
    ["Images", String(r.images)]
  ];
}
