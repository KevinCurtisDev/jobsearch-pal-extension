# Progress: JobSearch Pal

## Current state
*Rewritten at the end of every session (15 lines or fewer). A new session starts here.*
- **Milestone:** M0 Gates and platform (6 tasks: T0.1–T0.6), 3 of 6 done, on branch `m0-gates-platform`.
- **Last done:** 2026-11-17 T0.3 brand module (`src/core/brand.ts`), `_locales/en`, `__MSG_*__` manifest, G6 brand scan in `check-dist`.
- **Next step:** `/implement-task T0.4`.
- **Waiting for the owner:** `npm install` OK during T0.5; review any G1 allowlist entry Dexie or Zod needs.
- **Manual checks pending in Chrome:** T0.3: `chrome://extensions` shows "JobSearch Pal: Job Application Tracker".
- **Gates:** `npm run verify` green (58 unit tests); `test:e2e` 5/5.

## Log
*One line per completed task: date · task ID · note.*
- 2026-11-17 · T0.1 · src/core purity: ESLint restricted globals/imports, tsconfig.core.json (ES2023 only), lint fixture test
- 2026-11-17 · T0.2 · G1 network audit: networkHits + loadNetworkAllowlist, 2 Web Store prefix URLs allowlisted, bad fixture test
- 2026-11-17 · T0.3 · brand.ts + _locales/en; check-dist resolves __MSG_ before length checks; G6 scan of dist/ + shipped source with fixture; dev build marks extName (dev)
