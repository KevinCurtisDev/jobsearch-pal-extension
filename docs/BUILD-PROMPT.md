# Build prompt: JobSearch Pal Job Tracker (factory edition)

## 1. Role
You are building the free-for-life, local-only Chrome extension that is the first product of jobsearchpal.com. It is useful on day one with no account, no server and no AI, and it lets the user take their data to the platform later, by choice. Work only inside this repository, in small, tested steps, using the factory workflow: /plan-feature, owner approval, /implement-task, /verify-extension.

## 2. Read first (each session reads only what its task needs)
CLAUDE.md and the "Current state" block of docs/PROGRESS.md always. Then, as the task requires: docs/source/17-jobpilot-spec-review.md (takes precedence over 16), docs/source/16-chrome-extension.md, docs/DECISIONS.md, docs/RECONCILE.md, docs/source/decisions-needed.md, .claude/rules/product.md. If a source the task needs is missing or contradictory, stop and report.

## 3. Product rules
- No network requests of any kind: no analytics, telemetry, CDN fonts or images, or remote code.
- No accounts, backend, cloud storage or AI. All data stays in the browser.
- Never submit anything for the user and never auto-apply. Never invent experience. Never fill special-category fields (health, ethnicity, religion and similar).
- Every score shows its reasons, data source and confidence, and has a waiting state when data is thin.
- Never call a vacancy a "scam" or a "ghost job". Show signals and let the user decide.
- On LinkedIn, Indeed and Glassdoor: no page reading, script injection or UI changes. The user clicks the icon, and the extension uses only the tab URL and title plus text the user types or pastes.
- Reading a page uses page-inject (activeTab + scripting, on click only), on supported sites only.
- In-page hide or highlight is a later phase, only on Tier A sites the user enables one origin at a time.
- Anything free that runs on the device stays free. No paywall in the local edition.
- The codename "JobPilot" and the old names "Hearback" and "Offerlight" never appear in shipped files. Brand strings live only in src/core/brand.ts and _locales/en/messages.json.

## 4. Scope: phase 1 only (tracker core), as milestones
- M0: gates and platform.
- Spikes: S1, S2, S5, S6, S10, S12, and S13.
  - S13 (new): test whether a Save job button inside the side panel receives an activeTab grant for the current tab, with and without openPanelOnActionClick. Record the result and the fallback (capture from the toolbar icon click).
- M1: Checkpoint A, the vertical slice in docs/source/17 §10.
- M2 onwards: Checkpoint B, the backlog in docs/source/17 §9, in its stated order.

Do not start later-phase features: filtering, CV import, matching, autofill, interview centre, recruiter CRM, or analytics beyond stage odds.

## 5. Technical decisions (as approved in docs/DECISIONS.md; change only through a new ADR and the owner)
- **Build and UI:** the factory build (esbuild, strict TypeScript) and createElement UI with CSS variables from design/tokens.json.
- **Folders:**
  - src/core holds pure logic and has no chrome, window or document (lint-enforced);
  - src/storage holds Dexie access;
  - src/adapters holds the capture adapters;
  - src/ui holds UI components;
  - src/background, src/sidepanel and src/page are the extension contexts.
- **Data:**
  - Dexie for storage, with Zod validating at every boundary (storage, messages, import).
  - The data model is docs/source/17 §3. Records use ULID ids.
  - Append-only applicationEvents are the source of truth; application status is a projection that a test rebuilds from the events.
  - Money is stored as integer minor units with currency and period. Date-only values are YYYY-MM-DD; instants are ISO UTC.
  - There is an automatic snapshot before each upgrade, and import is idempotent by event id.
- **Messages:** phase 1 defines only CAPTURE_JOB and SAVE_JOB, as Zod-validated, versioned unions, routed through src/background/router.ts. Every message is checked for sender, origin and tab. No message returns a whole record, and there is no generic database message.
- **Service worker:** register listeners synchronously and keep no state in globals. Writes are idempotent, multi-record changes go in Dexie transactions, and alarms are reconciled on every start.
- **Permissions:** storage, activeTab, scripting, sidePanel, alarms, notifications. No host permissions. No tabs, webRequest, cookies, history, <all_urls> or externally_connectable. Minimum Chrome 120. unlimitedStorage only as optional, after S10 passes.
- **Safety:** render captured text as text only. Allow safe URL schemes only, and cap the size of imports.
- **Backups:**
  - versioned JSON with a checksum, and a dry-run import with merge or replace;
  - passphrase-encrypted export (PBKDF2 and AES-GCM with a random salt and IV per file);
  - CSV with spreadsheet-formula escaping;
  - a 30-day backup reminder, a "what is stored" screen and delete-everything.

## 6. Gates (built in M0, then part of npm run verify or CI)
1. Network audit of dist/ for fetch, XMLHttpRequest, WebSocket, sendBeacon, EventSource, remote import() and external URLs, with a fixture proving it fails when it should.
2. Permission diff against the budget (scripts/check-dist.ts, already present).
3. An offline Playwright run with the network blocked.
4. Bundle size budgets, set after M1 and recorded in the repo.
5. The src/core purity lint, a licence check, npm audit, and a reproducible build.
6. axe and keyboard tests on every new screen, meeting WCAG 2.2 AA, with 44 px targets, visible focus and meaning never conveyed by colour alone.
7. Brand test: "JobPilot", "Hearback" and "Offerlight" are absent from dist/ and from every shipped file.

## 7. Working method
- Use the factory workflow: one branch per milestone, Conventional Commits with task IDs, and no commits to main without asking.
- Write tests with the code, and update the relevant doc when behaviour changes.
- Every adapter uses saved HTML fixtures (synthetic or properly permitted, redacted) and offers a manual-capture fallback when extraction fails.
- Treat every claim about Chrome behaviour as unverified until you've read current documentation or tested it. Record results in docs/source/17 §12 as "verified (link, date)" or "tested (spike id)", and never invent citations.

## 8. Stop and ask the owner when
- a task needs an open decision whose default the owner hasn't accepted (docs/source/decisions-needed.md);
- a spike fails, or Chrome behaviour contradicts the docs;
- a task needs a new permission, dependency or network call, or reading or changing a page on a site outside Tier A;
- anything would change what stored data means, add personal-data collection, or touch the store listing wording;
- anything conflicts with the X or P rules or CLAUDE.md.

## 9. Report at each milestone
- What was built.
- Acceptance results with evidence (test names).
- Spike results.
- Permissions and dependencies added.
- Open questions, and what you need from the owner.

No code walk-throughs.
