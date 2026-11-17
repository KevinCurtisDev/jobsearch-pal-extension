// Review form for the current tab's draft (SPEC §3 F4, F8). Captured text is page data and hostile: it is
// only ever put into inputs as values or into nodes with textContent. `draftFromForm` is pure (no DOM).
import { provenance } from "../core/jsonld";
import { JobDraftSchema, LIMITS, type JobDraft } from "../core/model";
import { explain } from "../page-inject/reasons";
import type { TabDraft } from "../page-inject/report";
import { el } from "./dom";

export const FIELDS = ["title", "company", "location", "url", "description"] as const;
export type FieldName = (typeof FIELDS)[number];
export type FormValues = Record<FieldName, string>;
export type FormResult = { ok: true; draft: JobDraft } | { ok: false; errors: Partial<Record<FieldName, string>> };

const LABELS: Record<FieldName, string> = {
  title: "Job title",
  company: "Company",
  location: "Location",
  url: "Job post address (URL)",
  description: "Job description",
};

const REQUIRED: ReadonlySet<FieldName> = new Set(["title", "url"]);

const MESSAGES: Record<FieldName, { empty: string; invalid: string }> = {
  title: { empty: "Enter a job title.", invalid: `Use ${LIMITS.title} characters or fewer.` },
  company: { empty: "", invalid: `Use ${LIMITS.company} characters or fewer.` },
  location: { empty: "", invalid: `Use ${LIMITS.location} characters or fewer.` },
  url: { empty: "Enter the job post's address.", invalid: "Enter the full address from the browser bar, starting with https or http." },
  description: { empty: "", invalid: `Use ${LIMITS.description.toLocaleString("en")} characters or fewer.` },
};

/** The form's starting values: the draft's text fields (empty when absent). */
export function formValues(draft: JobDraft): FormValues {
  return {
    title: draft.title.value,
    company: draft.company?.value ?? "",
    location: draft.location?.value ?? "",
    url: draft.url.value,
    description: draft.description?.value ?? "",
  };
}

/**
 * The draft to save: unchanged fields keep their provenance; edited or pasted ones become `manual` with
 * confidence 1 at `now`; cleared optional fields are dropped. The draft id stays (SAVE_JOB is idempotent by it).
 */
export function draftFromForm(base: JobDraft, values: FormValues, now: string): FormResult {
  const start = formValues(base);
  const out: Record<string, unknown> = { id: base.id, capturedAt: base.capturedAt };
  if (base.pay) out.pay = base.pay;
  const errors: Partial<Record<FieldName, string>> = {};
  for (const name of FIELDS) {
    const v = values[name].trim();
    if (v === "") {
      if (REQUIRED.has(name)) errors[name] = MESSAGES[name].empty;
      continue;
    }
    out[name] = v === start[name].trim() && base[name] ? base[name] : provenance(v, "manual", 1, now);
  }
  const parsed = JobDraftSchema.safeParse(out);
  if (parsed.success && Object.keys(errors).length === 0) return { ok: true, draft: parsed.data };
  // Every field with a problem gets its message at once; an empty required field keeps its own message.
  for (const issue of parsed.success ? [] : parsed.error.issues) {
    const name = issue.path[0];
    if (typeof name === "string" && (FIELDS as readonly string[]).includes(name)) errors[name as FieldName] ??= MESSAGES[name as FieldName].invalid;
  }
  if (Object.keys(errors).length === 0) errors.title = "This draft can't be saved. Capture the page again.";
  return { ok: false, errors };
}

export type ReviewHandlers = {
  /** Saves the draft; resolves to an error text, or null on success. */
  save: (draft: JobDraft) => Promise<string | null>;
  now: () => string;
};

/** The review form for one tab draft. */
export function renderReview(entry: TabDraft, handlers: ReviewHandlers): HTMLElement {
  const section = el("section", "card review");
  section.setAttribute("aria-labelledby", "review-title");
  const heading = el("h2", "section-title", "Review this job");
  heading.id = "review-title";
  section.append(heading);

  if (entry.mode === "url-only") section.append(el("p", "note", explain(entry.reason)));

  const form = el("form", "review-form");
  form.noValidate = true;
  const inputs = {} as Record<FieldName, HTMLInputElement | HTMLTextAreaElement>;
  const errorNodes = {} as Record<FieldName, HTMLElement>;
  const start = formValues(entry.draft);

  for (const name of FIELDS) {
    const id = `field-${name}`;
    const wrap = el("div", "field");
    const label = el("label", "field-label", LABELS[name] + (REQUIRED.has(name) ? " (required)" : ""));
    label.htmlFor = id;
    let input: HTMLInputElement | HTMLTextAreaElement;
    if (name === "description") {
      input = el("textarea", "field-input field-textarea");
      input.rows = 6;
    } else {
      input = el("input", "field-input");
      input.type = name === "url" ? "url" : "text";
      input.autocomplete = "off";
    }
    input.id = id;
    input.name = name;
    input.value = start[name];
    if (REQUIRED.has(name)) input.required = true;
    const describedBy: string[] = [];
    if (name === "description") {
      const hint = el("p", "field-hint", entry.mode === "url-only" ? "Paste the job description from the page here." : "Edit or paste the job description.");
      hint.id = `${id}-hint`;
      describedBy.push(hint.id);
      wrap.append(label, hint);
    } else {
      wrap.append(label);
    }
    const err = el("p", "field-error");
    err.id = `${id}-error`;
    err.hidden = true;
    describedBy.push(err.id);
    input.setAttribute("aria-describedby", describedBy.join(" "));
    wrap.append(input, err);
    form.append(wrap);
    inputs[name] = input;
    errorNodes[name] = err;
  }

  const button = el("button", "button-primary", "Save job");
  button.type = "submit";
  const status = el("p", "form-status");
  status.setAttribute("role", "status");
  form.append(button, status);

  // The button is never disabled while saving: that would drop keyboard focus. A flag stops double saves.
  let saving = false;
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (saving) return;
    const values = {} as FormValues;
    for (const name of FIELDS) values[name] = inputs[name].value;
    const result = draftFromForm(entry.draft, values, handlers.now());
    for (const name of FIELDS) {
      const msg = result.ok ? undefined : result.errors[name];
      errorNodes[name].textContent = msg ?? "";
      errorNodes[name].hidden = !msg;
      if (msg) inputs[name].setAttribute("aria-invalid", "true");
      else inputs[name].removeAttribute("aria-invalid");
    }
    if (!result.ok) {
      status.textContent = "Fix the fields with a message, then save again.";
      const first = FIELDS.find((n) => result.errors[n]);
      if (first) inputs[first].focus();
      return;
    }
    saving = true;
    status.textContent = "Saving…";
    void handlers.save(result.draft).then((error) => {
      saving = false;
      status.textContent = error ?? "Saved. It's in your list below.";
    });
  });

  section.append(form);
  return section;
}

/** Shown when the current tab has no draft yet. */
export function renderNoDraft(): HTMLElement {
  const section = el("section", "card review");
  section.setAttribute("aria-labelledby", "review-title");
  const heading = el("h2", "section-title", "Save a job");
  heading.id = "review-title";
  section.append(heading, el("p", "note", "Open a job post and click the toolbar icon to capture it here for review."));
  return section;
}
