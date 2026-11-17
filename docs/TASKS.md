# Tasks: JobSearch Pal

*Active milestone only; move finished milestones to `docs/archive/`. Each task fits one session and
lists the files it touches, so Claude reads only those. Helper: `node scripts/tasks.ts list | next | show T1.1 | check`.*

## Milestones
| ID | Goal | Status |
|---|---|---|
| M0 | Gates and platform: six-permission budget, side panel shell, Dexie and Zod, pure `src/core`, brand module, network/brand/licence gates, offline e2e | done (`docs/archive/M0-tasks.md`) |
| M1 | Checkpoint A, vertical slice (`docs/source/17` §10): click the icon on a Greenhouse or JSON-LD page, review, save, see it in the side panel, export, re-import with a dry-run | planned |

**M1 exit criteria:** the six 17 §10 acceptance tests pass (three fixture pages save; worker killed mid-save loses nothing; export then import into an empty profile gives an identical event log; restricted-site tab saves from URL, title and pasted text; axe has no serious issues on the side panel; zero network calls); S13 result recorded; M1 bundle sizes recorded; permissions unchanged (six, no `downloads`); `npm run verify` and `npm run test:e2e` green; owner's manual QA in Chrome passes.

## M1: Vertical slice

### T1.1 Spike S13: side panel activeTab grant `[x]`
- **Goal:** find out whether a button in the side panel gets an activeTab grant for the current tab, with and without `openPanelOnActionClick`, and record the result.
- **Files:** `tests/e2e/spike-s13.spec.ts`, `docs/DECISIONS.md`, `docs/source/17-jobpilot-spec-review.md`, `docs/QA.md`
- **Depends on:** none
- **Spec:** §3 F2
- **Done when:** the spike runs both settings and calls `scripting.executeScript` after a trusted click in the panel; the result is recorded as "tested (S13)" in ADR-013 and 17 §12, with the chosen flow (toolbar-click capture stays the default; a panel "Capture again" button only if S13 passes); no production code changes; `npm run verify` green
- **Manual check:** owner repeats the spike in desktop Chrome (steps in `docs/QA.md`)

### T1.2 Core data model, ULID and projection `[x]`
- **Goal:** the pure M1 model in `src/core`: ULIDs, `JobDraft`, Job, Application, ApplicationEvent schemas, field provenance, and status projected from events.
- **Files:** `src/core/ulid.ts`, `src/core/model.ts`, `src/core/projection.ts`, `src/core/index.ts`, `tests/unit/ulid.test.ts`, `tests/unit/model.test.ts`, `tests/unit/projection.test.ts`
- **Depends on:** none
- **Spec:** §3 F4, F5
- **Done when:** ULIDs are sortable and monotonic within the same millisecond, with randomness and clock injected; schemas reject oversized strings and non-http(s) URLs; money is integer minor units plus ISO 4217 currency plus period; date-only values are `YYYY-MM-DD` and instants ISO UTC; every captured field carries source, confidence and time; `rebuildProjections(events)` matches the stored projections in tests; `npm run verify` green
- **Manual check:** none

### T1.3 Storage v2: save transaction and reads `[x]`
- **Goal:** Dexie v2 adds `jobs`, `applications` and `applicationEvents`, with one storage-module write path (`saveJob`, also used by import later) and validated reads.
- **Files:** `src/storage/db.ts`, `src/storage/jobs.ts`, `src/background/index.ts`, `tests/e2e/db.spec.ts`
- **Depends on:** T1.2
- **Spec:** §3 F4, F5
- **Done when:** the v1 to v2 upgrade keeps `meta` rows; `saveJob` validates with the T1.2 Zod schemas and writes job, application and `created` event in one transaction; the same draft id twice stores one job; rows that fail Zod on read are skipped and counted; an e2e test kills the worker mid-save and finds the save either complete or absent, never partial; `listJobs` returns newest first; `npm run verify` and `npm run test:e2e` green
- **Manual check:** none

### T1.4 Extractors: JSON-LD and Greenhouse `[x]`
- **Goal:** turn page data into a `JobDraft` with provenance.
- **Files:** `src/core/jsonld.ts`, `src/adapters/greenhouse.ts`, `src/adapters/index.ts`, `tests/unit/jsonld.test.ts`, `tests/unit/greenhouse.test.ts`, `tests/fixtures/pages/jsonld-valid.html`, `tests/fixtures/pages/jsonld-malformed.html`, `tests/fixtures/pages/greenhouse.html`
- **Depends on:** T1.2
- **Spec:** §3 F2
- **Done when:** the JSON-LD parser handles `@graph`, arrays, `JobPosting` subtypes, HTML in the description (reduced to text) and malformed JSON (returns null, no throw); the Greenhouse adapter is tested on a synthetic fixture with jsdom; every field carries source and confidence; fixtures are synthetic; `npm run verify` green
- **Manual check:** none

### T1.5 Capture wiring: CAPTURE_JOB and X3 sites `[ ]`
- **Goal:** the toolbar click captures a `JobDraft` (or a URL-only draft) and stores it per tab for the side panel.
- **Files:** `src/page/main.ts`, `src/page/collect.ts`, `src/page/view.ts` (deleted), `src/page-inject/activate.ts`, `src/page-inject/background.ts`, `src/page-inject/reasons.ts`, `src/page-inject/report.ts`, `src/page-inject/report-store.ts`, `src/shared/messages.ts`, `tests/unit/reasons.test.ts`, `tests/unit/page-inject.test.ts`, `tests/e2e/inject-action.spec.ts`, `tests/e2e/pages/jsonld.html`, `tests/e2e/pages/jsonld-malformed.html`, `tests/e2e/pages/greenhouse.html`
- **Depends on:** T1.1, T1.4
- **Spec:** §3 F2, F3
- **Done when:** X3 hosts never get injection, with unit tests: `linkedin.com`, `www.linkedin.com`, `ie.indeed.com`, `indeed.com`, `glassdoor.com`, `glassdoor.co.uk` match; `notlinkedin.com`, `linkedin.com.example.org`, `indeed.com.evil.test` do not; `CAPTURE_JOB` replies are Zod-validated and top-frame only; drafts live in `chrome.storage.session` keyed by tab with its default access level (no `setAccessLevel` call; a test asserts content scripts can't read it), never in worker globals; the page script never changes the page; e2e covers the three fixture pages plus a URL-only draft; `npm run verify` and `npm run test:e2e` green
- **Manual check:** click the icon on a real Greenhouse posting (full draft) and on linkedin.com (URL-only draft, nothing injected)

### T1.6 Side panel: review, save, list `[ ]`
- **Goal:** the panel shows the current tab's draft as a form, saves it through `SAVE_JOB`, and lists saved jobs.
- **Files:** `src/sidepanel/main.ts`, `src/sidepanel/review.ts`, `src/sidepanel/list.ts`, `src/ui/tokens.css`, `src/background/save.ts`, `src/background/modules.ts`, `src/shared/messages.ts`, `tests/unit/router.test.ts`, `tests/e2e/sidepanel.spec.ts`
- **Depends on:** T1.3, T1.5
- **Spec:** §3 F4, F5, F8
- **Done when:** `SAVE_JOB` is a versioned Zod union routed through `router.ts`, accepted only from extension pages, calls `saveJob` and returns `{ jobId }` only; pasted text works on URL-only drafts; captured text is rendered with `textContent` only; the list updates after a save; labelled inputs, 44 px targets and a keyboard-only flow are tested in e2e; `npm run verify` and `npm run test:e2e` green
- **Manual check:** save a job and see it listed; Tab through the whole flow at 320 px wide

### T1.7 JSON export and dry-run import `[ ]`
- **Goal:** a versioned, checksummed backup file, and an import that shows a dry-run before an idempotent merge.
- **Files:** `src/core/backup.ts`, `src/storage/backup.ts`, `src/storage/jobs.ts`, `src/sidepanel/backup.ts`, `src/sidepanel/main.ts`, `tests/unit/backup.test.ts`, `tests/e2e/backup.spec.ts`
- **Depends on:** T1.6
- **Spec:** §3 F6, F7
- **Done when:** export is a versioned JSON file with a SHA-256 checksum, downloaded through a blob URL and an `<a download>` link (no `downloads` permission); import rejects corrupt, over-10 MB, wrong-version and bad-checksum files with plain messages; the dry-run shows new / already present / invalid counts; confirmed import writes through `src/storage/jobs.ts` in one transaction with the same Zod schemas as `SAVE_JOB`; importing the same file twice adds nothing (idempotent by event id); export then import into a fresh profile gives an identical event log (e2e); `npm run verify` and `npm run test:e2e` green
- **Manual check:** export, remove and reinstall the extension, import, and see the job back

### T1.8 Slice acceptance: axe, offline and sizes `[ ]`
- **Goal:** prove the six 17 §10 acceptance tests and record the M1 bundle sizes.
- **Files:** `package.json`, `package-lock.json`, `tests/e2e/a11y.spec.ts`, `tests/e2e/offline.spec.ts`, `tests/e2e/slice.spec.ts`, `docs/QA.md`, `docs/PROGRESS.md`
- **Depends on:** T1.7
- **Spec:** §3 F2, F3, F4, F5, F6, F7, F8; §6
- **Done when:** `@axe-core/playwright` added as an exact-pinned dev dependency (ADR-016); axe has no serious or critical issues on the panel in empty, review and list states; the offline spec covers capture, save, export and import with zero external requests; `scripts/measure.ts` sizes recorded as the M1 baseline; permissions still the six in ADR-006; `npm run verify` and `npm run test:e2e` green
- **Manual check:** the full M1 checklist in `docs/QA.md` in Chrome
