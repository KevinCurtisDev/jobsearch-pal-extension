# Progress: JobSearch Pal

## Current state
*Rewritten at the end of every session (15 lines or fewer). A new session starts here.*
- **Milestone:** M0 Gates and platform (6 tasks: T0.1–T0.6), 1 of 6 done, on branch `m0-gates-platform`.
- **Last done:** 2026-11-17 T0.1 core purity gate (ESLint `src/core/**` block + `tsconfig.core.json` in `typecheck`).
- **Next step:** `/implement-task T0.2`.
- **Waiting for the owner:** `npm install` OK during T0.5; review any G1 allowlist entry Dexie or Zod needs.
- **Manual checks pending in Chrome:** none.
- **Gates:** `npm run verify` green (44 unit tests).

## Log
*One line per completed task: date · task ID · note.*
- 2026-11-17 · T0.1 · src/core purity: ESLint restricted globals/imports, tsconfig.core.json (ES2023 only), lint fixture test
