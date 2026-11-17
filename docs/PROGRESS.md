# Progress: JobSearch Pal

## Current state
*Rewritten at the end of every session (15 lines or fewer). A new session starts here.*
- **Milestone:** M1 Checkpoint A, vertical slice, on branch `m1-vertical-slice` (T1.1–T1.6 done; T1.7–T1.8 open).
- **Last done:** 2026-11-17 T1.6: side panel review form for the active tab's `draft.<tabId>` (follows tab switches and draft changes, keeps edits otherwise) → `SAVE_JOB` v1 (`src/background/save.ts`, extension pages only, reply `{ jobId }`) → list re-read from Dexie in the panel (ADR-017). Edited/pasted fields become `manual`, confidence 1.
- **Next step:** `/implement-task T1.7`.
- **Waiting for the owner:** repeat S13 in desktop Chrome (`docs/QA.md` M1, first item) and record the version and result. Confirm the six statuses (RECONCILE C8) before M2 status editing.
- **Manual checks pending in Chrome:** S13 (T1.1); T1.5: icon on a real Greenhouse posting and on linkedin.com; T1.6: save a job and see it listed; Tab through the whole flow at 320 px.
- **Gates:** `npm run verify` green (144 unit tests); `test:e2e` 29/29 at T1.6. G1 allowlist 4 entries.
- **Conditions (ADR-017):** session storage at default access level; import via `src/storage/jobs.ts`, same Zod as SAVE_JOB; no new permission, including `downloads`.
- **Gap:** F8's axe check is not automated (no axe dependency; adding one needs owner approval). e2e covers labels, 44 px, 320 px, keyboard flow, visible focus.
- **Note:** G1 flags `http://` in any shipped string, including UI text; word messages without scheme literals.
- **Note:** e2e opens `sidepanel.html` in a tab and stores the draft under that tab's own id (`chrome.tabs.getCurrent`); the real panel is a CDP `page` target (see `tests/e2e/spike-s13.spec.ts`).
- **Note:** modules using Zod import `zod/mini` plus `src/shared/zod-guard.ts`. `src/core` has no `URL` global.

## Log
*One line per completed task: date · task ID · note.*
- 2026-11-17 · T0.1 · src/core purity: ESLint restricted globals/imports, tsconfig.core.json (ES2023 only), lint fixture test
- 2026-11-17 · T0.2 · G1 network audit: networkHits + loadNetworkAllowlist, 2 Web Store prefix URLs allowlisted, bad fixture test
- 2026-11-17 · T0.3 · brand.ts + _locales/en; check-dist resolves __MSG_ before length checks; G6 scan of dist/ + shipped source with fixture; dev build marks extName (dev)
- 2026-11-17 · T0.4 · six permissions; side_panel + no popup (check-dist rejects default_popup); sidePanel.open before activateTab; tokens-css generator; G4 side panel file
- 2026-11-17 · T0.5 · dexie/zod exact; licence-check.ts in verify; audit in release-check; db.ts meta v1; zod-guard (jitless); 2 Dexie URLs allowlisted (owner); e2e db round-trip
- 2026-11-17 · T0.6 · offline.spec.ts: net fixture (context.route abort+record, page+sw), net-log worker-start check, 3 canaries; S12 tested; fixtures launchExtension/readyWorker
- 2026-11-17 · T1.1 · S13 spike e2e (both panel settings, controls for grant/revoke/activation): side-panel click gets no activeTab in Chromium 158; toolbar capture kept
- 2026-11-17 · T1.2 · core ULID (monotonic, injected clock/random), Zod model with provenance/pay/dates, applyEvent + rebuildProjections (20 seeded logs match)
- 2026-11-17 · T1.3 · Dexie v2 stores (meta kept on upgrade, e2e); saveJob one transaction + idempotent by draftId; listJobs newest first, skips/counts bad rows; SIGKILL mid-save e2e
- 2026-11-17 · T1.4 · core JSON-LD parser (@graph, arrays, nested, typed IRIs/subtypes, linear HTML→text, pay in minor units via Intl, malformed → null); Greenhouse adapter (2 layouts); captureDraft merge + manual fallback; synthetic fixtures
- 2026-11-17 · T1.5 · CAPTURE_JOB to frame 0 with Zod reply check; X3 host matching by registrable domain (look-alike tests); per-tab drafts in storage.session (content scripts denied, e2e); URL-only drafts; view.ts and report messages removed; e2e JSON-LD, malformed, Greenhouse, LinkedIn
- 2026-11-17 · T1.6 · SAVE_JOB v1 (save.ts, extension pages only, { jobId }); panel review form (draftFromForm, manual provenance for edits/paste), list from Dexie; e2e keyboard flow, 44 px at 320 px, hostile text, URL-only paste, errors
