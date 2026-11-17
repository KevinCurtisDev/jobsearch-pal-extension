---
name: verify-extension
description: Run every automated check for this extension, fix real failures without weakening checks, and list the manual Chrome checks still to do. Use when the owner asks to verify, test or check the extension.
disable-model-invocation: true
---
Verify this extension. Work only inside this repository; prefer the scripts over reading code.

1. Run, in order, and record pass/fail and counts:
   - `npm run verify` (typecheck, lint, unit tests, build, dist/ permission and code check)
   - `npm run test:e2e` if `tests/e2e/` exists (needs `npm run test:e2e:install` once)
   - `npm audit`
   - `node scripts/tasks.ts check` and `node scripts/tasks.ts list`
   - `npm run measure`
2. For each failure: find the root cause, fix it, re-run. Never disable rules, skip tests, loosen
   `scripts/check-dist.ts` or change the permission budget. If a fix needs a dependency or permission
   change, stop and ask. `npm audit` findings in dev-only tools: report them with the suggested fix; ask before upgrading.
3. Read `docs/QA.md` and list the manual Chrome checks for features done since the last release.
4. Commit fixes (`fix(...): ...`) and update the PROGRESS.md "Current state" block.
5. Reply with a table — Check · Result · Notes — then "Automated (Chromium) results" and
   "Manual checks for the owner in Chrome" as separate lists. Never claim a manual check passed.
