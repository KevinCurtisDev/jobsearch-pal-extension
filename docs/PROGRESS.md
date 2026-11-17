# Progress: JobSearch Pal

## Current state
*Rewritten at the end of every session (15 lines or fewer). A new session starts here.*
- **Milestone:** M1 Checkpoint A, vertical slice, on branch `m1-vertical-slice` (T1.1–T1.3 done; T1.4–T1.8 open).
- **Last done:** 2026-11-17 T1.3: Dexie v2 (`jobs` with unique `draftId`, `applications`, `applicationEvents`); `src/storage/jobs.ts` `saveJob` (one rw transaction, idempotent by draft id) and `listJobs` (newest first, invalid rows skipped and counted).
- **Next step:** `/implement-task T1.4`.
- **Waiting for the owner:** repeat S13 in desktop Chrome (`docs/QA.md` M1, first item) and record the version and result. Confirm the six statuses (RECONCILE C8) before M2 status editing.
- **Manual checks pending in Chrome:** S13 (T1.1).
- **Gates:** `npm run verify` green (99 unit tests); `test:e2e` 21/21 at T1.3. G1 allowlist 4 entries.
- **Conditions (ADR-017):** session storage at default access level; import writes via `saveJob`-style path in `src/storage/jobs.ts`, one transaction, same Zod as SAVE_JOB; X3 look-alike host tests; no new permission, including `downloads`.
- **Note:** SAVE_JOB is not wired yet: the worker builds `saveDeps` (ULID + ISO clock) and exposes `saveJob`/`listJobs` only on the e2e hook `__jspDb`; T1.6 adds the router handler.
- **Note:** writers update `applications` rows with `applyEvent`; `rebuildProjections(events)` must equal them. Callers pass `crypto.getRandomValues` to `createUlid`.
- **Note:** modules using Zod import `zod/mini` plus `src/shared/zod-guard.ts` (sets jitless). Never re-export the `z` namespace.
- **Note:** stopping the worker kills the test context; for crash tests use `launchExtension(args, userDataDir)` and SIGKILL the profile's processes (`tests/e2e/db.spec.ts`).
- **Note:** the real side panel is a CDP `page` target (not in `context.pages()`); drive it with a non-flattened attach (see `tests/e2e/spike-s13.spec.ts`).

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
