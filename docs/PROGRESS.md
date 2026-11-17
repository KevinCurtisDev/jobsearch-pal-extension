# Progress: JobSearch Pal

## Current state
*Rewritten at the end of every session (15 lines or fewer). A new session starts here.*
- **Milestone:** M0 Gates and platform (6 tasks: T0.1–T0.6), all 6 done, on branch `m0-gates-platform`.
- **Last done:** 2026-11-17 T0.6: offline e2e. `net` fixture aborts/records non-local requests (pages + worker); worker start checked via Chromium net log from launch; canaries prove both detectors. S12 tested (ADR-013).
- **Next step:** `/verify-extension` for M0, then the manual checks below.
- **Waiting for the owner:** nothing.
- **Manual checks pending in Chrome:** T0.3: `chrome://extensions` shows "JobSearch Pal: Job Application Tracker". T0.4: clicking the icon on a job page opens the side panel and the page capture still runs; install shows the new permission warnings.
- **Gates:** `npm run verify` green (73 unit tests); `test:e2e` 16/16. G1 allowlist 4 entries (2 Dexie error-message URLs, owner approved).
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
