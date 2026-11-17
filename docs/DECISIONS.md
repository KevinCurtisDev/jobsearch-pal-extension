# Decisions: JobSearch Pal

*One entry per decision, 8 lines or fewer. Newest last. Never rewrite an accepted entry; supersede it.*

## ADR-001 Generated from chrome-extension-factory 0.4.0
- **Status:** accepted
- **Decision:** start from the factory core with modules: e2e-playwright, page-inject, storage. Permission budget [activeTab, scripting, storage].
- **Why:** shared, tested build, lint, security and packaging setup; least-privilege permissions.
- **Consequences:** factory updates are applied manually (see the factory's VERSIONING guide); this repo is independent.

## ADR-002 Planning sources adopted as reconciled
- **Status:** accepted (2026-11-17, owner)
- **Decision:** adopt `docs/source/16`, `17` (wins over 16), ADR 0007 and ADR 0008 as the product plan, as adapted by `docs/RECONCILE.md` and ADR-003 to ADR-009.
- **Why:** the sources mark them "Proposed" and block work past Phase 0 until approved.
- **Consequences:** where a source and an ADR here differ, the ADR here wins. Rules X1–X11 and P1–P12 live in `.claude/rules/product.md`.

## ADR-003 Build stack stays the factory build (D1)
- **Status:** accepted (2026-11-17, owner)
- **Decision:** esbuild and plain TypeScript; UI built with `createElement` + `textContent`. No WXT, React or Radix. Styles use CSS variables generated from `design/tokens.json`; no raw hex values in components.
- **Why:** keeps the security lint, `check-dist` and factory modules intact; fewer runtime dependencies (supply chain risk R5).
- **Consequences:** supersedes the WXT/React/Radix parts of `docs/source/17` §5 and `16` §6.4. Board and dialogs are hand-built (native `<dialog>`; keyboard "move to" menu as the Kanban baseline).

## ADR-004 Runtime dependencies: Dexie and Zod; MiniSearch deferred (D2)
- **Status:** accepted (2026-11-17, owner)
- **Decision:** add Dexie and Zod, pinned to exact versions and licence-checked before they land. MiniSearch is deferred to a later phase; Phase 1 search is a plain filter.
- **Why:** Dexie gives IndexedDB transactions, indexes and migrations for the event log; Zod validates messages, storage read-back and import files (hard rule 4).
- **Consequences:** `chrome.storage` (factory storage module) keeps small settings only. The built bundle must still pass `bannedCode` with Zod in it (check its runtime eval probe; use jitless or `zod/mini` if needed, never loosen the gate). Deviates from `17` §1 (F08 in E1). Added in M0.

## ADR-005 Source layout and core purity (D3)
- **Status:** accepted (2026-11-17, owner)
- **Decision:** `packages/core|storage|adapters|ui` map to `src/core|storage|adapters|ui`; data packs to `src/data`. `src/core` may not use `chrome`, `window`, `document` or browser-only modules: an ESLint block (restricted globals and imports) plus `tsconfig.core.json` (`lib: ES2023`, no DOM or chrome types) in `npm run typecheck`.
- **Why:** core logic must be pure and testable; `docs/source/16` §6.1 rule.
- **Consequences:** adapters take `(document, url)`, live in `src/adapters`, are bundled into the page script and tested on saved fixtures with jsdom. Lint and tsconfig added in M0.

## ADR-006 Phase 1 permissions (D4)
- **Status:** accepted (2026-11-17, owner)
- **Decision:** budget becomes [storage, activeTab, scripting, sidePanel, alarms, notifications]. No host permissions, no content scripts. `unlimitedStorage` only as an optional permission, and only after spike S10 passes. Minimum Chrome 120.
- **Why:** `docs/source/17` §6; all warning permissions in place before the first alpha upload so existing users are not disabled later.
- **Consequences:** `extension.config.json`, the manifest and CLAUDE.md hard rule 1 change in M0, not before. Optional `unlimitedStorage` needs `check-dist` to accept an exact optional list (separate approval). "Did you apply?" cannot auto-trigger in Phase 1.

## ADR-007 Git workflow: factory milestone branches (D5)
- **Status:** accepted (2026-11-17, owner)
- **Decision:** one branch per milestone (`m<N>-<slug>`), one local commit per task, no pull requests for now.
- **Why:** no remote exists; keeps the factory workflow.
- **Consequences:** CI does not run and `docs/source/06` §13 "required checks on main" is not met until a remote exists; `npm run verify` locally is the gate. Push, merge and tags still need the owner (hard rule 6).

## ADR-008 Naming of phases, milestones and rules (D6)
- **Status:** accepted (2026-11-17, owner)
- **Decision:** the sources' E0–E4 are Phase 0–4. Work here is milestones M0, M1, … with tasks `T<milestone>.<n>`. Extension rules are X1–X11, platform rules P1–P12; spikes keep S1–S12.
- **Why:** "E1" was both a phase and a rule in the sources.
- **Consequences:** read "E1" in the sources as Phase 1 (or rule X1 in a rules context).

## ADR-009 Brand: JobSearch Pal (D7)
- **Status:** accepted (2026-11-17, owner)
- **Decision:** `BRAND_NAME = "JobSearch Pal"`, `PLATFORM_DOMAIN = "jobsearchpal.com"`, in `src/core/brand.ts`, which reads the name from `src/shared/product.ts` (generated from `extension.config.json`, the root source). Store title "JobSearch Pal: Job Application Tracker" (no "and CV Check" until a CV check exists) and description live in `_locales/en/messages.json`, generated from or checked against the config. The codename "JobPilot" never ships; neither do "Hearback" or "Offerlight".
- **Why:** one place to change the name; the sources disagreed on it (RECONCILE C1).
- **Consequences:** supersedes the "Hearback" default for decision #22; trademark, CRO and domain checks still gate the store listing. X1 still applies: the local edition never contacts jobsearchpal.com, which is used only in links the user chooses to open. M0 adds: check-dist resolves `__MSG_*__` before its length checks, and the build fails if "jobpilot", "hearback" or "offerlight" (case-insensitive) appears in `dist/` or any shipped file (`docs/` and `docs/source/` are not shipped and not scanned).

## ADR-010 Open owner decisions: proceed on defaults (D8)
- **Status:** accepted (2026-11-17, owner)
- **Decision:** proceed on the defaults in `docs/source/decisions-needed.md` for #23, #24, #26, #27, #31–#36: free-for-life wording per 16 §1; ADR 0008 Tier C policy; dedicated publisher account now, trader status after incorporation; platform date internal only; encrypted export only; extracted text only until S10; Chrome 120; free for life; hiding on Tier A only, per-site opt-in; ULIDs. #22 is settled by ADR-009.
- **Why:** none of the defaults blocks Phase 1 code (RECONCILE D8).
- **Consequences:** the alpha upload still needs the publisher account (#26) and name clearance (#22). Solicitor review of the #23 wording comes before listing copy.

## ADR-011 Where brand strings live (clarifies ADR-009)
- **Status:** accepted (2026-11-17, owner)
- **Decision:** in hand-written source, the brand name, store title and domain appear only in `src/core/brand.ts` and `_locales/en/messages.json`. `extension.config.json` stays the root; generated files (`src/shared/product.ts`, manifest, `package.json`) follow it.
- **Why:** `docs/BUILD-PROMPT.md` §3 and the factory's generated files disagreed (RECONCILE follow-up).
- **Consequences:** renaming = config + those two files + regenerate. The brand test (G6) scans shipped files, not `docs/`.

## ADR-012 Side panel entry and toolbar behaviour
- **Status:** accepted (2026-11-17, owner)
- **Decision:** side panel lives in `src/sidepanel/` with `sidepanel.html`. The worker sets `openPanelOnActionClick: false`; `action.onClicked` calls `chrome.sidePanel.open({ tabId })` first, with no `await` before it, then `activateTab`. No `default_popup`. Panel styles come from CSS variables generated from `design/tokens.json` at build time (no dependency).
- **Why:** with `openPanelOnActionClick: true`, `action.onClicked` stops firing and toolbar capture would break.
- **Consequences:** one click opens the panel and captures. The side-panel Save button waits for spike S13 (M1). Headless Chromium may reject `open`; errors are caught and logged.

## ADR-013 Phase 1 spikes, including S13
- **Status:** accepted (2026-11-17, owner)
- **Decision:** Phase 1 runs spikes S1, S2, S5, S6, S10, S12 and S13. S13: does a Save job button inside the side panel get an activeTab grant for the current tab, with and without `openPanelOnActionClick`? Fallback: capture from the toolbar icon click.
- **Why:** `docs/BUILD-PROMPT.md` §4; M1's capture flow depends on S13.
- **Consequences:** results are recorded as "tested (spike id)". S12 is expected to pass via the factory e2e module (confirmed in T0.6).
- **Results:** S12 tested (S12, 2026-11-17, T0.6): Playwright 1.65 drives the extension in a persistent Chromium context (worker, side panel page, toolbar click via CDP); `context.route` intercepts both page and service-worker requests (canary tests in `tests/e2e/offline.spec.ts`).

## ADR-014 M0 gate policy and dependency versions
- **Status:** accepted (2026-11-17, owner)
- **Decision:** `dexie` 4.4.7 (Apache-2.0) and `zod` 4.6.7 (MIT), exact versions, no `^` or `~`. G1 allowlist (`scripts/network-allow.json`) holds exact strings only, each with a reason; no wildcard or pattern entries. Runtime licences limited to MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD.
- **Why:** supply chain risk (R5) and X1.
- **Consequences:** `npm audit --omit=dev` runs at release (`verify` must work offline); e2e stays outside `verify` and runs in `/verify-extension`. Bundle budgets are set after M1; axe needs a separate dev-dependency approval.
