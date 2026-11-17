# Progress: JobSearch Pal

## Current state
*Rewritten at the end of every session (15 lines or fewer). A new session starts here.*
- **Milestone:** M1 Checkpoint A, vertical slice, on branch `m1-vertical-slice` (T1.1–T1.7 done; T1.8 open).
- **Last done:** 2026-11-17 T1.7: panel "Back up and restore": export = `jobsearch-pal-backup` v1 JSON (jobs + event log, SHA-256 over canonical JSON) via blob URL + `<a download>`; import checks size/JSON/format/version/checksum/Zod, dry-run counts, confirmed import via `importBackup` in `src/storage/jobs.ts` (one transaction, merge by id, applications rebuilt from events).
- **Next step:** `/implement-task T1.8` (adds `@axe-core/playwright`: ADR-016 covers it; confirm with the owner if unsure).
- **Waiting for the owner:** repeat S13 in desktop Chrome (`docs/QA.md` M1, first item) and record the version and result. Confirm the six statuses (RECONCILE C8) before M2 status editing.
- **Manual checks pending in Chrome:** S13 (T1.1); T1.5: icon on a real Greenhouse posting and on linkedin.com; T1.6: save a job and see it listed; Tab through the whole flow at 320 px; T1.7: export, remove and reinstall, import, see the job back.
- **Gates:** `npm run verify` green (160 unit tests); `test:e2e` 31/31 at T1.7. G1 allowlist 4 entries.
- **Conditions (ADR-017):** session storage at default access level; no new permission, including `downloads`.
- **Import rules:** a file job whose draftId is stored under another id is counted invalid (with its events); events for unknown jobs or a mismatched application are invalid. Backup omits `applications` (projections).
- **Gap:** F8's axe check is not automated yet (T1.8). e2e covers labels, 44 px, 320 px, keyboard flow, visible focus.
- **Note:** G1 flags `http://` in any shipped string, including UI text; word messages without scheme literals.
- **Note:** e2e opens `sidepanel.html` in a tab; the review form owns the only `role="status"`; the backup status is `#backup-status` (aria-live).
- **Note:** modules using Zod import `zod/mini` plus `src/shared/zod-guard.ts`. `src/core` has no `URL` global or Web Crypto (digest injected).

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
- 2026-11-17 · T1.7 · core/backup.ts (canonical JSON + injected SHA-256, readBackup errors, planImport merge by id); storage importBackup one transaction; panel export/dry-run/confirm; e2e fresh-profile identical log, idempotent re-import, bad files, cancel
