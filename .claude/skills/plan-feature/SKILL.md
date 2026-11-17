---
name: plan-feature
description: Turn the product brief or a feature idea into an approved spec section and a milestone task plan in docs/SPEC.md and docs/TASKS.md. Use when the owner asks to plan the MVP, a feature or the next milestone.
argument-hint: "[mvp | short feature description]"
disable-model-invocation: true
---
Plan **$ARGUMENTS** (default: `mvp`) for this extension. Work only inside this repository.

## 1. Read (only these)
`docs/PROGRESS.md` (Current state), `docs/PRODUCT_BRIEF.md`, `docs/SPEC.md`, `extension.config.json`,
`docs/REPO-MAP.md`, and `node scripts/tasks.ts list`. Open source files only if a decision depends on them.

## 2. Fill gaps (ask once, briefly)
If the brief still has ⟨placeholders⟩ that matter for this plan, ask the owner at most 5 short
questions in one message. Otherwise make sensible assumptions and list them.

## 3. Draft (show it, don't write files yet)
- **Spec:** numbered, testable features for SPEC.md §3 (F1, F2, …) with acceptance criteria; non-goals.
- **Milestone:** goal and exit criteria.
- **Tasks:** 3–8 tasks, each one session long, in this exact format:
  ```
  ### T1.1 Short title `[ ]`
  - **Goal:** one sentence
  - **Files:** `src/...`, `tests/unit/...`   (every file the task will touch)
  - **Depends on:** none | T1.1
  - **Spec:** §3 F1
  - **Done when:** testable criteria; `npm run verify` green
  - **Manual check:** what the owner checks in Chrome, or none
  ```
  Put pure logic (parsing, formatting, rules) in its own file with unit tests. Prefer reusing existing modules (`docs/REPO-MAP.md`).
- **Needs approval:** list separately anything that requires the owner's explicit yes:
  new permissions or host access (compare with `permissions` in extension.config.json), new or paid
  dependencies, accounts/servers/analytics, or architecture changes. Include a one-line ADR draft for each.

End with: "Reply **approve** to write this plan, or tell me what to change."

## 4. After the owner approves
1. Write SPEC.md §3/§7, the milestone row and tasks in TASKS.md (replace the placeholder comment), and
   approved ADRs in DECISIONS.md (8 lines each). Never change the permission budget or dependencies here.
2. `node scripts/tasks.ts check` must pass.
3. Rewrite the "Current state" block in docs/PROGRESS.md (next step: `/implement-task`).
4. `git add docs && git commit -m "docs: plan <milestone>"`.
5. Reply in 5 lines or fewer: milestone, task IDs, what needs the owner, next command.
