// Saves the last page report in chrome.storage.local (page-inject + storage).
import { defineKey, read, write } from "../storage/store";
import { parseReport, type PageReport } from "./report";

export const LAST_REPORT = defineKey<PageReport | null>("local", "lastReport", (v) => (v === null ? null : parseReport(v)), null);

export async function saveReport(report: PageReport): Promise<boolean> {
  await write(LAST_REPORT, report);
  return true;
}

export function lastReport(): Promise<PageReport | null> {
  return read(LAST_REPORT);
}
