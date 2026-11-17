# Progress: JobSearch Pal

## Current state
*Rewritten at the end of every session (15 lines or fewer). A new session starts here.*
- **Milestone:** M1 Checkpoint A, vertical slice: done, verified, merged into `main` (ADR-019) and pushed to origin (owner, 2026-11-17).
- **Last done:** 2026-11-17 T1.8: `@axe-core/playwright` 4.14.0 (exact, dev, ADR-016); a11y.spec (empty, review, errors, list, import dry-run + canary); slice.spec (acceptance 1 and 4 end to end, header maps all six); offline.spec covers capture → save → export → import; bundle sizes in `npm run measure`, M1 baseline in `docs/QA.md`.
- **Next step:** `/plan-feature` for M2. No release until Phase 1 (E1) is complete (ADR-020); `release-0.2.0` branch parked with listing/privacy drafts.
- **Owner QA:** M1 checklist passed in Chrome 158 (2026-11-17); S13 `ok: false` both settings (ADR-013). Decided: statuses = the brief's six (ADR-021); bundle budget = M1 baseline + 25%, enforced by check-dist (ADR-022).
- **Gates (2026-11-17, after the location fix):** `npm run verify` green (165 unit tests); `test:e2e` 36/36; `npm audit --omit=dev` 0; full audit 11 high, all GHSA-fc5q-39xc-vjpf (picomatch, dev-only, ADR-018). Permissions still the six.
- **Bundle baseline (prod):** 342,072 B / 112,851 B gzip total (sidepanel.js 149.7 kB, background.js 143.3 kB, page.js 38.9 kB).
- **Import rules:** a file job whose draftId is stored under another id is invalid (with its events); events for unknown jobs or a mismatched application are invalid. Backup omits `applications` (projections).
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
- 2026-11-17 · T1.8 · @axe-core/playwright 4.14.0 exact (ADR-016); a11y.spec with canary; slice.spec acceptance 1 and 4; offline capture→save→export→import; measure.ts bundle sizes, M1 baseline + M1 checklist in QA.md
- 2026-11-17 · fix · Greenhouse location: split on ; and |, drop repeats ("NYC; SF | NYC" → "NYC; SF"), seen on live job-boards pages
- 2026-11-17 · ADR-021/022 · statuses = brief's six; bundle budget (baseline + 25%) in scripts/bundle-budget.json, checked by check-dist with unit tests
