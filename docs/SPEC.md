# Spec: JobSearch Pal

*Source of truth for what the extension does. Short, numbered, testable. Update it before changing behaviour.*

## 1. Summary
Save job posts from the page you're on, track each application's status, set reminders, back up and export. Free and local-only.

## 2. Users and main flow
- **User:** a job seeker browsing a job board or company career site.
- **Main flow (M1):** on a job page, click the toolbar icon → the side panel opens and shows the captured draft → review and edit the fields → Save → the job appears in the panel's list with status `saved` → Export downloads a JSON backup → Import shows a dry-run, then merges.
- On LinkedIn, Indeed and Glassdoor the click captures only the tab URL and title; the user pastes the rest (X3).

## 3. Features (each must be testable)
- **F1 Side panel shell (M0):** clicking the toolbar icon opens the side panel on the current tab, and page capture still runs on the same click. The panel shows the brand name and an empty state, built with `createElement` and styled only with CSS variables generated from `design/tokens.json`. The manifest has no `default_popup`.
- **F2 Capture on click (M1):** clicking the toolbar icon reads schema.org `JobPosting` JSON-LD, or the Greenhouse adapter, into a `JobDraft`: title, company, location, URL, description text and pay if present. Each field records source (`jsonld` | `adapter` | `manual`), confidence and time. Malformed JSON-LD gives a manual draft from URL and title, never an error. Nothing is read without a click (X4).
- **F3 URL-only capture (M1):** on linkedin.com, indeed.com (all country subdomains), glassdoor.* (including subdomains) and pages that can't be scripted, nothing is injected (X3); the draft holds only the tab URL and title plus text the user pastes. Host matching is by registrable domain: look-alikes such as `notlinkedin.com` or `linkedin.com.example.org` don't match.
- **F4 Review and save (M1):** the side panel shows the current tab's draft as an editable form (text rendered as text only; http(s) URLs only). Drafts are kept per tab in `chrome.storage.session` at its default access level (not readable by content scripts). Save sends `SAVE_JOB` (versioned Zod union, extension pages only) to the worker, which writes job, application and a `created` event with ULIDs in one Dexie transaction. Idempotent by draft id; killing the worker mid-save loses nothing and leaves nothing partial. The reply is `{ jobId }` only.
- **F5 Saved list (M1):** the panel lists saved jobs newest first with title, company and status. Status is a projection rebuilt from `applicationEvents` (tested).
- **F6 JSON backup (M1):** Export downloads one versioned JSON file (`format`, `schemaVersion`, `exportedAt`, records, SHA-256 checksum) through a blob URL and `<a download>`; no `downloads` permission.
- **F7 Import with dry-run (M1):** the chosen file is capped at 10 MB, checksum- and Zod-checked; a dry-run shows new / already present / invalid counts before the user confirms. Confirmed imports write through the same storage module as `SAVE_JOB`, in one transaction, with the same Zod checks; idempotent by event id. Export then import into an empty profile gives an identical event log.
- **F8 Accessible panel (M1):** axe reports no serious or critical issues; the whole flow works by keyboard with visible focus and 44 px targets, at 320 px wide.

## 4. Later (not in Phase 1)
- In-page filtering, CV import, matching, autofill, interview centre, recruiter CRM, analytics beyond stage odds (`docs/BUILD-PROMPT.md` §4).
- Full-text search with MiniSearch (ADR-004).

## 5. Permissions, storage and privacy
- Permission budget: [activeTab, scripting, storage, sidePanel, alarms, notifications] (ADR-006, applied in T0.4: manifest, `extension.config.json`, check-dist). No host permissions, no content scripts. `unlimitedStorage` only as optional, after spike S10. Minimum Chrome 120. Any change needs an ADR.
- Records live in IndexedDB through Dexie; `chrome.storage` holds small settings only (ADR-004). Zod validates every boundary.
- Data stays on the device. No network requests, analytics or remote code (X1, X2).

## 6. Security rules and gates
- No HTML sinks; build DOM with createElement + textContent. Validate everything read from storage, messages and files.
- **G1 network audit:** `check-dist` fails on `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, remote `import()` and any `http(s)://` string in built JS, HTML, CSS or JSON that is not in `scripts/network-allow.json`. Allowlist entries are exact strings, each with a reason; no wildcards or patterns.
- **G3 core purity:** `src/core` uses no `chrome`, `window`, `document` or browser-only modules (ESLint block + `tsconfig.core.json`).
- **G4:** `check-dist` checks the side panel file exists.
- **G6 brand scan:** "jobpilot", "hearback", "offerlight" (case-insensitive) fail the build if found in `dist/` or shipped source (`src/`, `public/`, `_locales/`, `build.json`, `extension.config.json`). `docs/` is not scanned.
- **Licences:** runtime dependencies limited to MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD (`scripts/licence-check.ts` in `verify`). `npm audit --omit=dev` runs in `release-check`.
- **Offline e2e:** the main flows make zero external requests (`tests/e2e/offline.spec.ts`). The `net` fixture aborts and records every request not to the local test origin or `chrome-extension://` (pages and service worker). Worker start happens before routes can exist, so it is checked with Chromium's net log from launch. Canary tests prove both detectors see requests.

## 7. Non-goals (M1)
- No status or notes editing, tags, kanban, dedupe, reminders (alarms, notifications), CSV, encrypted export, adapters other than JSON-LD and Greenhouse, or search (M2 onwards).
- No new permissions (including `downloads`) and no new runtime dependencies.
- Bundle budgets: M1 baseline + 25% per `dist/` file and in total (ADR-022, `scripts/bundle-budget.json`, enforced by check-dist).
