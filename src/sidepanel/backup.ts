// Back up and restore (SPEC §3 F6, F7; X9). Export: a versioned, checksummed JSON file downloaded through a
// blob URL and an <a download> link (no `downloads` permission). Import: the file is checked, a dry-run
// shows what would change, and only a confirmed import writes (through src/storage/jobs.ts).
import { MAX_BACKUP_BYTES, READ_ERROR_MESSAGES, backupFileName, createBackup, readBackup, type BackupData, type ImportCounts } from "../core/backup";
import type { Db } from "../storage/db";
import { previewImport, readBackupData } from "../storage/backup";
import { importBackup } from "../storage/jobs";
import { el } from "./dom";

/** SHA-256 of the UTF-8 text as lowercase hex (Web Crypto). */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The dry-run lines: new / already saved / invalid (and updates to saved jobs, when there are any). */
export function previewLines(c: ImportCounts): string[] {
  const lines = [`New jobs: ${c.newJobs}`, `Already saved: ${c.presentJobs}`, `Invalid records (skipped): ${c.invalid}`];
  if (c.updatedJobs > 0) lines.splice(2, 0, `Saved jobs with new history: ${c.updatedJobs}`);
  return lines;
}

/** What the status line says after a confirmed import. */
export function importedText(c: ImportCounts): string {
  if (c.newJobs === 0 && c.updatedJobs === 0) return "Nothing new was imported.";
  const parts = [`Imported ${plural(c.newJobs, "new job", "new jobs")}`];
  if (c.updatedJobs > 0) parts.push(`updated ${plural(c.updatedJobs, "saved job", "saved jobs")}`);
  return `${parts.join(" and ")}. They're in your list below.`;
}

function download(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = el("a", "visually-hidden");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type BackupHandlers = { db: Db; now: () => string; onImported: () => Promise<void> };

export function renderBackup(h: BackupHandlers): HTMLElement {
  const section = el("section", "card backup");
  section.setAttribute("aria-labelledby", "backup-title");
  const heading = el("h2", "section-title", "Back up and restore");
  heading.id = "backup-title";
  section.append(heading, el("p", "note", "Your jobs are stored only in this browser. Export a backup file to keep a copy, and import it to restore."));

  const status = el("p", "form-status");
  status.id = "backup-status";
  status.setAttribute("aria-live", "polite");

  // Export
  const exportButton = el("button", "button-primary", "Export backup");
  exportButton.type = "button";
  let exporting = false;
  exportButton.addEventListener("click", () => {
    if (exporting) return;
    exporting = true;
    void (async () => {
      try {
        const { data, skipped } = await readBackupData(h.db);
        const at = h.now();
        const file = await createBackup(data, at, sha256Hex);
        const name = backupFileName(at);
        download(JSON.stringify(file, null, 2), name);
        const left = skipped > 0 ? ` ${plural(skipped, "stored record", "stored records")} couldn't be read and ${skipped === 1 ? "was" : "were"} left out.` : "";
        status.textContent = `Backup ready: ${name}, with ${plural(data.jobs.length, "job", "jobs")}.${left}`;
      } catch {
        status.textContent = "The backup couldn't be made. Try again.";
      } finally {
        exporting = false;
      }
    })();
  });

  // Import
  const field = el("div", "field backup-import");
  const label = el("label", "field-label", "Import a backup file");
  label.htmlFor = "backup-file";
  const hint = el("p", "field-hint", "Choose a .json file exported from this extension. You'll see what it contains before anything is added.");
  hint.id = "backup-file-hint";
  const input = el("input", "field-input");
  input.type = "file";
  input.id = "backup-file";
  input.accept = ".json,application/json";
  input.setAttribute("aria-describedby", "backup-file-hint backup-status");
  field.append(label, hint, input);

  const preview = el("div", "backup-preview");
  preview.hidden = true;

  let pending: { data: BackupData; invalid: number } | null = null;
  const clearPreview = () => {
    pending = null;
    preview.hidden = true;
    preview.replaceChildren();
  };
  const reset = () => {
    clearPreview();
    input.value = "";
  };

  input.addEventListener("change", () => {
    clearPreview();
    const file = input.files?.[0];
    if (!file) return;
    void (async () => {
      if (file.size > MAX_BACKUP_BYTES) {
        status.textContent = READ_ERROR_MESSAGES["too-large"];
        input.value = "";
        return;
      }
      status.textContent = "Checking the file…";
      let text: string;
      try {
        text = await file.text();
      } catch {
        status.textContent = "The file couldn't be opened. Try again.";
        input.value = "";
        return;
      }
      const read = await readBackup(text, file.size, sha256Hex);
      if (!read.ok) {
        status.textContent = READ_ERROR_MESSAGES[read.error];
        input.value = "";
        return;
      }
      let counts: ImportCounts;
      try {
        counts = await previewImport(h.db, read.data, read.invalid);
      } catch {
        status.textContent = "Your saved jobs couldn't be read to compare. Try again.";
        input.value = "";
        return;
      }
      showPreview(read.data, read.invalid, counts);
    })();
  });

  function showPreview(data: BackupData, invalid: number, counts: ImportCounts): void {
    const title = el("h3", "preview-title", "Before you import");
    title.id = "backup-preview-title";
    title.tabIndex = -1;
    const ul = el("ul", "preview-counts");
    for (const line of previewLines(counts)) ul.append(el("li", "", line));
    preview.setAttribute("role", "group");
    preview.setAttribute("aria-labelledby", title.id);
    preview.replaceChildren(title, ul);
    if (counts.newJobs === 0 && counts.updatedJobs === 0) {
      status.textContent = "Nothing new to import: this file has nothing that isn't already saved.";
      preview.hidden = false;
      input.value = "";
      return;
    }
    pending = { data, invalid };
    const actions = el("div", "button-row");
    const confirm = el("button", "button-primary", "Import");
    confirm.type = "button";
    const cancel = el("button", "button-secondary", "Cancel");
    cancel.type = "button";
    actions.append(confirm, cancel);
    preview.append(actions);
    preview.hidden = false;
    status.textContent = "Check the counts, then choose Import or Cancel.";
    title.focus();

    let importing = false;
    confirm.addEventListener("click", () => {
      if (importing || !pending) return;
      importing = true;
      const { data: d, invalid: inv } = pending;
      status.textContent = "Importing…";
      void (async () => {
        try {
          const done = await importBackup(h.db, d, inv);
          reset();
          status.textContent = importedText(done);
          await h.onImported();
        } catch {
          status.textContent = "Nothing was imported. Try again.";
        } finally {
          importing = false;
          input.focus();
        }
      })();
    });
    cancel.addEventListener("click", () => {
      reset();
      status.textContent = "Import cancelled. Nothing was added.";
      input.focus();
    });
  }

  section.append(exportButton, el("hr", "divider"), field, preview, status);
  return section;
}
