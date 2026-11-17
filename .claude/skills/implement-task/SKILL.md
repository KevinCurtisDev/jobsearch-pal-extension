---
name: implement-task
description: Implement one approved task from docs/TASKS.md end to end (tests, code, verify, tick, commit, handoff). Use when the owner asks to implement, build or do the next task.
argument-hint: "[task ID, e.g. T1.2; default: next]"
disable-model-invocation: true
---
Implement task **$ARGUMENTS** (default: the next one). Work only inside this repository.

1. **Load only what's needed.** Run `node scripts/tasks.ts show $ARGUMENTS` (or `next` if no ID) and read
   the "Current state" block of `docs/PROGRESS.md`. Read the files listed under **Files**, plus the SPEC
   section it cites. Open other files only when an import or failing test requires it. Don't scan the repo.
2. **Stop and ask** before: adding a permission or host access, adding or upgrading a dependency,
   changing architecture beyond the task, or changing user-visible behaviour the spec doesn't cover.
3. **Branch:** if on `main`, create `git switch -c m<N>-<slug>` for the milestone (or switch to it).
4. **Tests first** for pure logic in `tests/unit/`. Then implement, following `CLAUDE.md` rules.
5. **Gate:** `npm run verify` until green. If `tests/e2e/` exists and the task changes UI, page scripts or
   messaging, also `npm run test:e2e`. Never weaken lint rules, tests or `scripts/check-dist.ts`.
6. **Record:** `node scripts/tasks.ts done <ID>`; add one line to the PROGRESS.md log
   (`date · ID · short note`) and rewrite its "Current state" block (15 lines or fewer).
7. **Commit:** `git add -A && git commit -m "feat(<area>): <ID> <summary>"` (use fix/test/docs as fits).
   Never push, merge to main, tag or rewrite history without asking.
8. **Report** in this format, nothing more:
   ```
   Done: <ID> <title>
   Changed: <files>
   Verified: npm run verify ✔ (<n> unit tests)<; test:e2e ✔ n/n>
   Manual check in Chrome: <from the task, or none>
   Decisions/assumptions: <or none>
   Next: /implement-task <next ID> (or /verify-extension when the milestone is done)
   ```
