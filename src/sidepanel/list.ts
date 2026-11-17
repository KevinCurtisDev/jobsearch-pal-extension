// Saved jobs list (SPEC §3 F5): newest first with title, company and status. Rows come from `listJobs`,
// which has already validated them with Zod; text goes in with textContent only.
import type { Status } from "../core/model";
import type { JobList } from "../storage/jobs";
import { el } from "./dom";

export const STATUS_LABELS: Record<Status, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export function renderList(list: JobList | null): HTMLElement {
  const section = el("section", "saved");
  section.setAttribute("aria-labelledby", "saved-title");
  const heading = el("h2", "section-title", "Saved jobs");
  heading.id = "saved-title";
  section.append(heading);

  if (list === null) {
    section.append(el("p", "note", "Saved jobs can't be shown right now. Close and reopen the panel."));
    return section;
  }
  if (list.items.length === 0) {
    const empty = el("div", "empty");
    empty.append(el("p", "empty-title", "No saved jobs yet"), el("p", "empty-text", "Jobs you save will be listed here, with their status and notes."));
    section.append(empty);
  } else {
    const ul = el("ul", "job-list");
    for (const { job, application } of list.items) {
      const li = el("li", "job-item");
      // job.url passed HttpUrlSchema when the row was read, so it is an http(s) address.
      const link = el("a", "job-title", job.title.value);
      link.href = job.url.value;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      li.append(link);
      if (job.company) li.append(el("p", "job-company", job.company.value));
      li.append(el("p", "job-status", `Status: ${application ? STATUS_LABELS[application.status] : "Unknown"}`));
      ul.append(li);
    }
    section.append(ul);
  }
  if (list.skipped > 0) section.append(el("p", "note", `${list.skipped} stored ${list.skipped === 1 ? "record" : "records"} couldn't be read and ${list.skipped === 1 ? "is" : "are"} not shown.`));
  return section;
}
