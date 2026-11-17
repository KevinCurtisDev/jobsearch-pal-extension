# Progress: JobSearch Pal

## Current state
*Rewritten at the end of every session (15 lines or fewer). A new session starts here.*
- **Milestone:** M1 Checkpoint A, vertical slice: planned on branch `m1-vertical-slice` (T1.1–T1.8, owner approved 2026-11-17). M0 archived in `docs/archive/M0-tasks.md`.
- **Last done:** 2026-11-17 plan M1: SPEC §2, F2–F8, §7; ADR-016 (axe dev dep, exact pin), ADR-017 (capture flow and data model, with conditions), ADR-018 (picomatch advisory accepted as dev-only; prod audit 0).
- **Next step:** `/implement-task T1.1` (spike S13). T1.2 has no dependencies and can follow.
- **Waiting for the owner:** nothing.
- **Manual checks pending in Chrome:** none yet (T1.1 adds the S13 check).
- **Gates:** `npm run verify` green (73 unit tests); `test:e2e` 16/16. G1 allowlist 4 entries (2 Dexie error-message URLs, owner approved).
- **Conditions (ADR-017):** session storage at default access level; import writes via `src/storage/jobs.ts`, one transaction, same Zod as SAVE_JOB; X3 look-alike host tests; no new permission, including `downloads`.
- **Note:** modules using Zod import `zod/mini` plus `src/shared/zod-guard.ts` (sets jitless). Never re-export the `z` namespace: it defeats tree-shaking and pulls json-schema.org URLs into the bundle.
- **Note:** `chrome.runtime.reload()` and stopping the worker via CDP both kill the test context (command-line-loaded extension); use `launchExtension` with extra args for fresh-start checks.

## Log
*One line per completed task: date · task ID · note.*
- 2026-11-17 · T0.1 · src/core purity: ESLint restricted globals/imports, tsconfig.core.json (ES2023 only), lint fixture test
- 2026-11-17 · T0.2 · G1 network audit: networkHits + loadNetworkAllowlist, 2 Web Store prefix URLs allowlisted, bad fixture test
- 2026-11-17 · T0.3 · brand.ts + _locales/en; check-dist resolves __MSG_ before length checks; G6 scan of dist/ + shipped source with fixture; dev build marks extName (dev)
- 2026-11-17 · T0.4 · six permissions; side_panel + no popup (check-dist rejects default_popup); sidePanel.open before activateTab; tokens-css generator; G4 side panel file
- 2026-11-17 · T0.5 · dexie/zod exact; licence-check.ts in verify; audit in release-check; db.ts meta v1; zod-guard (jitless); 2 Dexie URLs allowlisted (owner); e2e db round-trip
- 2026-11-17 · T0.6 · offline.spec.ts: net fixture (context.route abort+record, page+sw), net-log worker-start check, 3 canaries; S12 tested; fixtures launchExtension/readyWorker
