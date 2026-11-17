# Reconciliation: planning sources vs this factory repo

**Date:** 2026-11-17 · **Status:** waiting for the owner's answers to §3 · **No code written.**

Sources read: `CLAUDE.md`, `docs/source/PLANNING-CLAUDE.md`, `17-jobpilot-spec-review.md`
(takes precedence over 16), `16-chrome-extension.md`, `adr/0007`, `adr/0008`, `02-build-stages.md`
(Track E), `decisions-needed.md`, `06-security.md` §13, `13-privacy-and-compliance.md` §16.
Factory side checked: `extension.config.json`, `src/manifest.json`, `eslint.config.js`,
`scripts/check-dist.ts`, `scripts/dist-rules.ts`, `.claude/rules/*`, `.claude/skills/*`,
`.github/workflows/ci.yml`, `.githooks/*`.

Short names used below: **"the sources"** = `docs/source/*`; **"the factory"** = this repo as generated.
Planning phases E0–E4 are written as **Phase 0–4** to avoid clashing with rules X1–X11.

---

## 1. Missing or contradictory sources

### 1.1 Referenced but not in this repo

Contents are not guessed; only the impact of the gap is stated.

| # | Missing | Referenced by | Impact on phase 1 |
|---|---|---|---|
| M1 | **JobPilot build specification v0.1** | `17` throughout (F01–F29, "the spec's 21 stores", "the spec's 14 defaults" statuses, provenance "spec section 5", weights) | **High.** The status list, store list and provenance fields that 17 adopts cannot be confirmed. |
| M2 | `docs/07-design-system.md`, `docs/08-screens.md` ("Extension surfaces"), `design/README.md` (design canvas link) | PLANNING-CLAUDE §4, 16 §14.6, 02 Phase 0 | **High** for every UI task. Only `design/tokens.json` is here. Phase 0 task "design the extension surfaces" has no recorded result. |
| M3 | `content/hiring_stages.json` | 16 B1, 02 Phase 1 ("Stage odds") | **High** for stage odds. Feature cannot ship without it. |
| M4 | `frontend/src/features/self-check` ("Should I move?", "In a year") | 02 Phase 1, 16 B6 | **High** for that feature. Platform frontend is not in this independent repo. |
| M5 | `docs/04-data-model.md` | 17 §3.9 | Medium. Extension store prose lives there. |
| M6 | `docs/10-external-apis.md` (site terms log, tier list) | 16 §8–9, ADR 0008 | Medium. Which Tier A sites may be read depends on per-site terms checks recorded there. |
| M7 | `docs/14-content-guidelines.md` | 17 R8 | Medium. Wording rules for stage odds and duplicate suggestions. |
| M8 | Spike results S1–S12; pass conditions for S10, S11, S12 | 16 §13 (S1–S9 defined), 02 and 17 (S10–S12 one-liners only) | Medium. Phase 1 needs S1, S2, S5, S6, S10 (and S12, see §2 X-notes). |
| M9 | Golden sets: ≥ 100 labelled duplicate pairs, 30 labelled JDs, CVs | 17 §4, 02 Phase 0, decision #10 | Medium. Duplicate thresholds stay "uncalibrated" and must not be shown as numbers until this exists. |
| M10 | `docs/STATUS.md`, `docs/00`, `01`, `03`, `09`, `docs/adr/0001` | PLANNING-CLAUDE §1, 16 §6.1 | Low. `docs/PROGRESS.md` replaces STATUS here. |
| M11 | `cv.schema.json`, `content/cv_conventions.json`, `competencies.json`, `linkedin_rules.json`, `prompts/README.md` | 16 §4 C–E, X7 | Low now (Phase 2+). |
| M12 | `extension/README.md`, `packages/README.md`, `.github/pull_request_template.md`, `Marketing/02-copy/extension-launch.md` | PLANNING-CLAUDE §1/§3, 16 §9 | Low (listing copy and D5 only). |
| M13 | **Owner approval** of docs/16, docs/17, ADR 0007, ADR 0008 (all "Proposed") | 02 Track E, PLANNING-CLAUDE | **Blocking by the sources' own rule.** Approve, or record in `docs/DECISIONS.md` which parts this repo adopts. |

### 1.2 Contradictions

| # | Where | Conflict | Proposed resolution |
|---|---|---|---|
| C1 | PLANNING-CLAUDE vs 16/17/ADRs vs `extension.config.json` | Product named "Offerlight (working name)", "Hearback", and "JobSearch Pal"; codename "JobPilot". | D7 and decision #22. |
| C2 | 16 §2 and 02 ("E1 to E10") vs PLANNING-CLAUDE (E1–E11) | E11 exists only in PLANNING-CLAUDE and bundles three rules (Tier A hiding, ULIDs, event log). | Use PLANNING-CLAUDE's 11 (X1–X11). |
| C3 | 16 §13 vs 02 / 17 | Spikes S1–S9 vs S1–S12. | Use the union. |
| C4 | 16 §10 vs 17 §6 vs 17 §10 vs factory | 16: `unlimitedStorage` required, `offscreen`, static Tier A content scripts, optional `https://*/*`. 17 §6 Phase 1: six permissions, no host access, `unlimitedStorage` optional after S10. 17 §10 slice: only four (no `alarms`, `notifications`). Factory budget: `activeTab, scripting, storage`; brief excludes `sidePanel, alarms, notifications` "until the owner approves". | 17 §6 wins; slice is a subset. D4. |
| C5 | 16 A4 + 02 Phase 1 task vs 17 §6 | "Did you apply?" prompt on ATS confirmation pages needs content scripts or host access; 17 removes both from Phase 1. | Unresolved in sources. Recommend a click-triggered variant (user clicks the toolbar on a confirmation page → "Mark as applied?"). Owner to confirm. |
| C6 | 02 Phase 1 acceptance vs 17 §6 | "No host patterns outside the Tier A list" assumes static Tier A matches; 17 says none at install. | 17 wins: zero host patterns. |
| C7 | 16/17 vs factory | IndexedDB via Dexie vs factory storage module on `chrome.storage` ("never call `chrome.storage` directly elsewhere") and brief "stored locally in chrome.storage". | D2. |
| C8 | 16 §7 vs 17 §3 vs factory brief | Event store `events` (9 types) vs `applicationEvents`; statuses: 16 = 6 (Saved, Applied, Screening, Interview, Offer, Closed), 17 = "spec's 14" (M1, not available) + 7 reporting groups, brief = 6 (saved, applied, interviewing, offer, rejected, withdrawn). | Adopt 17's 7 reporting groups as the fixed analytic set; default statuses need an owner pick because the 14 are not in the repo. |
| C9 | 17 §1 F08 + §10 vs 02 Phase 1 vs this session's brief | MiniSearch is E1 in 17 (and in the slice's install step); 02's Phase 1 list has no search; owner brief says E2+. | D2. |
| C10 | 16 §6.4 / 17 §5 vs factory | WXT + React + CSS Modules + Radix vs esbuild + plain TS + `createElement`. | D1. |
| C11 | 16 §6.1, 17 §5 vs factory + `CLAUDE.md` | Monorepo `packages/*` + `extension/` shared with a platform frontend vs a single independent `src/`. | D3. Sharing with the platform is not possible from here. |
| C12 | 17 §13 vs `decisions-needed.md` | 17 says #31–#36 include "open-source licence"; that is #25. #36 is the ID scheme. | Use the table. |
| C13 | PLANNING-CLAUDE + 02 vs `decisions-needed.md` | Nothing beyond Phase 0 until #22, #23, #24, #27 answered; but the table says #27 is needed by "End of E1" and #22 by "E0 exit". | Owner to answer or waive explicitly (D8). |
| C14 | PLANNING-CLAUDE §3 + 06 §13 vs factory | Protected `main`, branch + PR per task, CI checks required on `main` vs milestone branch, local commits. No git remote is configured here. | D5. |
| C15 | `decisions-needed.md` #33 vs `src/manifest.json` | Minimum Chrome is open (default 120), factory manifest already sets `"120"`. | Consistent with default; record when #33 is answered. |

---

## 2. Rules: what the factory already enforces

**Legend.** ✅ enforced by a gate · 🟡 partly enforced or enforced by policy only · ⬜ not enforced, needs a gate or task · n/a not applicable to the local edition.

### 2.1 Extension rules X1–X11 (planning E1–E11)

| ID | Rule | Factory today | Needed |
|---|---|---|---|
| X1 | Local edition makes no network requests. | 🟡 No host permissions (check-dist exact budget). `bannedCode` blocks remote scripts/imports **but not** `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`. CSP has no `connect-src`. | **Gate G1:** extend `dist-rules.ts` with a network-API and remote-URL scan (with a unit test that a bundle containing `fetch(` fails). Optional runtime belt: add `connect-src 'self'` to the CSP (tightening; [Assumed] it covers the service worker, verify). **Gate G8:** e2e run with network blocked. |
| X2 | No remote code. | ✅ CSP `script-src 'self'`; `bannedCode` (eval, `new Function`, remote import/importScripts/script); ESLint `no-eval`, `no-new-func`, `no-implied-eval`. | Nothing. Data packs bundled. |
| X3 | Nothing injected or read on LinkedIn, Indeed, Glassdoor. | 🟡 No `content_scripts` or hosts allowed (check-dist). **Gap:** `page-inject` runs `executeScript` on *any* tab the user clicks, including linkedin.com. | **Task + Gate G2:** Tier C denylist in `activateTab()` (linkedin.com, indeed.com and country subdomains, glassdoor.*) → capture from tab URL and title only, new failure reason; unit test on the matcher, e2e test that nothing is injected on a Tier C test URL. |
| X4 | Read only on user action or declared patterns. | ✅ Activation only on action click; no content scripts or hosts (check-dist). | Nothing for Phase 1 (no declared patterns yet). |
| X5 | Never submit anything. | 🟡 `page-inject` rule: never change page content. No autofill in Phase 1. | Cheap gate: ESLint block in `src/page/**` banning `.submit`, `.requestSubmit`, `.click()` dispatch. Full fixtures in Phase 3. |
| X6 | Never autofill or store special category fields. | ⬜ No profile in Phase 1. | Task (Phase 2, when the profile store lands): schema denylist test on profile/import. |
| X7 | Never invent experience; guard in core. | n/a until Phase 2 tailoring / Phase 4 AI. | Task in Phase 2. |
| X8 | Every score shows reasons, source, confidence, waiting state. | ⬜ | **Task:** `src/core` type `Explained<T> = { value, reasons, source, confidence } \| Waiting` and require it for stage odds and duplicate suggestions (typecheck enforces). |
| X9 | One-click export and delete; optional encrypted backup. | 🟡 Brief has JSON backup and CSV export; no encryption, no "what is stored", no delete-all. | **Tasks:** encrypted export (Web Crypto PBKDF2 + AES-GCM), delete everything, "what is stored", 30-day reminder; round-trip and corrupt-file tests. |
| X10 | Minimum permissions, each justified; no `<all_urls>`. | ✅ check-dist: exact permission and host match, bans optional perms, content scripts, `externally_connectable`, `web_accessible_resources`. Justification via CLAUDE hard rule 6 + `docs/DECISIONS.md` (policy). | **Gate G10 (small):** `release-check` fails if a manifest permission has no justification line in `docs/STORE_LISTING.md`. |
| X11 | In-page hide/highlight only on user-enabled Tier A; ULIDs; event log is the source of truth. | 🟡 Hiding is impossible today (optional hosts banned) — correct for Phase 1. ULID/event log not present. | **Tasks:** ULID generator in core (no dependency), append-only event log, projections + test "rebuild projections from events equals stored projections", idempotent import on event id. |
| X-core | `core` imports nothing from `chrome`, `window`, `document`. | ⬜ | **Gate G3** (D3). |
| X-free | Never move a shipped local feature behind a paywall. | n/a (policy). | Record in DECISIONS with #34. |

### 2.2 Platform rules P1–P12

| ID | Rule | Factory today | Needed |
|---|---|---|---|
| P1 | Rules and data decide, AI writes. | ✅ via X1 (no network, so no AI). | Nothing. |
| P2 | No auto-apply. | 🟡 = X5. | As X5. |
| P3 | No LinkedIn scraping; Tier C no content scripts. | 🟡 = X3. | As X3 (G2). |
| P4 | Never invent experience. | n/a = X7. | Phase 2. |
| P5 | Every score explained, calibrated, honest. | ⬜ = X8. Duplicate thresholds are uncalibrated (17 §4). | As X8; never show duplicate scores as numbers until M9 exists. |
| P6 | No face/emotion analysis. | n/a. | Nothing. |
| P7 | Privacy: never sell, export and delete, consent. | 🟡 X1 + X9. Consent n/a locally. | As X9. `docs/PRIVACY.md` updated per 13 §16. |
| P8 | WCAG 2.2 AA, 44 px targets, visible focus. | ⬜ Playwright present, no axe, no keyboard tests. | **Gate G7:** axe in e2e (`@axe-core/playwright` is a new dev dependency: owner approval), keyboard e2e, 320 px side panel viewport. |
| P9 | Security, secure defaults. | ✅ for the extension surface: HTML-sink lint, router validator + sender check, strict CSP. Passkeys etc. n/a. | **Task:** `chrome.storage.local.setAccessLevel('TRUSTED_CONTEXTS')` at worker start (06 §13; `storage.local` is exposed to content scripts by default). |
| P10 | Badges earned, never bought. | n/a. | Nothing. |
| P11 | Cost-efficient by default. | ✅ via X1 (no servers). | Nothing. |
| P12 | GDPR inventory; no PII in logs. | n/a for the inventory (13 §16: local edition holds no data on our side). No-PII-in-logs not enforced. | Small gate: ESLint `no-console` in `src/**` except `warn`/`error` with ids only; privacy policy and store declarations per 13 §16 before listing. |

### 2.3 Gate backlog (from §2 and 16 §6.3)

| Gate | What | Weakens anything? |
|---|---|---|
| G1 | Network-API and remote-URL scan of `dist/` | No, adds checks |
| G2 | Tier C denylist unit + e2e test | No |
| G3 | `src/core` purity (D3) | No |
| G4 | `referencedFiles` includes `side_panel.default_path` (otherwise a missing side panel file passes) | No |
| G5 | Budget gains an exact `optionalPermissions` list (needed only if `unlimitedStorage` goes optional, D4) | Changes check-dist: owner approval |
| G6 | Fail build if `dist/` contains `/jobpilot/i` (D7) | No |
| G7 | axe + keyboard e2e | New dev dependency: owner approval |
| G8 | e2e with network blocked | No |
| G9 | Bundle size budgets per entry (16 §6.3) | No |
| G10 | Permission justification check in `release-check` | No |
| G11 | `npm audit` in CI; licence check before first release (17 §5) | Licence checker = new dev dependency |

Reproducible build: 🟡 the factory's `scripts/package.ts` makes a deterministic zip; signed tags need D5.

---

## 3. Decisions for the owner

### D1 · Build stack

| Option | For | Against |
|---|---|---|
| **A. Factory build** (esbuild, plain TS, `createElement` UI, CSS variables from `design/tokens.json`) | Every gate here already works; no new runtime UI dependencies (supply chain risk R5); small bundles; HTML-sink lint fits naturally. | More hand-written UI code for the board, dialogs and import wizard; no component sharing with a platform frontend. |
| B. WXT + React + Radix + CSS Modules (17 §5) | Matches the sources; rich, accessible primitives; HMR. | Replaces `build.mjs`, manifest generation, `dist/` layout and e2e fixtures, so `check-dist` and the factory modules must be ported (risk of weakening gates); adds React, React DOM, Radix, WXT (owner approval each); "share with platform" does not apply to an independent repo. |
| C. Factory build + React via esbuild JSX + CSS Modules (esbuild `local-css`) | Keeps the gates; React later if needed. | Still adds React; no Radix unless approved. |

**Recommendation: A for Phase 1**, with a tiny typed `h()` element helper, native `<dialog>`, `<details>`, `<select>` (focus handling is built in at Chrome 120+) and a build step that turns `design/tokens.json` into `tokens.css` (no dependency). Revisit at the board/Kanban milestone; moving to C then does not change the build system.
**Consequences:** supersedes 17 §5 "WXT, React" for this repo (record an ADR); Kanban needs our own keyboard-first "move to" menu (17 already makes that the baseline).

### D2 · Runtime dependencies

| Library | Recommendation | Consequences |
|---|---|---|
| **Dexie** | **Adopt, pinned.** Event log, indexes for canonical URL/simhash prefix, transactions (R3: worker killed mid-write), versioned migrations. Keep the factory's `chrome.storage` module for small settings only. | `src/storage` gains `db.ts` behind the `Storage` port; the storage rule "never call `chrome.storage` directly" still holds; brief line "stored in chrome.storage" is amended. IndexedDB eviction stays an assumption until S5. |
| **Zod** | **Adopt, pinned**, for messages, export/import format and storage read-back (hard rule 4). | Replaces the hand validators over time. **[Assumed] must verify:** Zod 4 probes for `Function` support at runtime; confirm the built bundle still passes `bannedCode`. If not, use `jitless` / `zod/mini`; never loosen the gate. |
| **MiniSearch** | **Defer.** Phase 1 uses a plain filter over company/title/notes. | Deviates from 17 (F08 in E1, slice installs it). Add when a milestone needs ranked full-text search. |

### D3 · Structure

Map `packages/core → src/core`, `storage → src/storage`, `adapters → src/adapters`, `ui → src/ui`; data packs → `src/data`. Keep `src/background`, `src/page`, `src/page-inject`, `src/shared`. Core feature folders as in 17 §5 (`capture`, `tracker`, `tasks`, `backup`, …), created only when used.

Enforcement (**recommended: both**):
1. ESLint block for `src/core/**`: `no-restricted-globals` (`chrome`, `window`, `document`, `navigator`, `localStorage`, `indexedDB`) and `no-restricted-imports` for `../background`, `../page*`, `../storage`, `../ui`, `../adapters`, `dexie`. This only adds rules.
2. `tsconfig.core.json` with `lib: ["ES2023"]`, `types: []`, run by `npm run typecheck`, so DOM and `chrome` types do not exist in core at all.

**Consequences:** adapters take `(document, url)` and live in `src/adapters`, bundled into the injected `page.js` and tested on saved HTML fixtures with jsdom (already a dev dependency). `src/core` may import `src/shared/product.ts` (pure data).

### D4 · Permissions for Phase 1

**Recommendation: approve** `sidePanel`, `alarms`, `notifications` in `extension.config.json`; no host permissions; no content scripts; `unlimitedStorage` decided after S10.
- Add `sidePanel` with the first slice; `alarms` + `notifications` with the reminders task, **all before the first unlisted alpha upload**, because adding a warning permission later ("Display notifications") disables the extension for existing users until they accept.
- `unlimitedStorage` as optional needs G5 (check-dist currently bans `optional_permissions`). If S10 fails, the choices are required `unlimitedStorage` (no warning) or living within the 10 MB `storage.local` quota for settings plus IndexedDB's normal quota.
- **Consequence:** the "Did you apply?" prompt (C5) cannot auto-trigger in Phase 1; `docs/PRIVACY.md`, `docs/STORE_LISTING.md` and DECISIONS are updated in the same commit as each permission.

### D5 · Git workflow

| Option | Needs | Consequence |
|---|---|---|
| **A. Factory:** milestone branch `m<N>-<slug>`, one commit per task, owner merges | Nothing | CI never runs (no remote); 06 §13 "required checks on main" not met. |
| B. Branch + PR per task (PLANNING-CLAUDE) | GitHub repo, `gh` auth, branch protection | Many tiny PRs; you merge each. |
| C. Milestone branch, commit per task, **one PR per milestone** | Same as B | CI runs on each push to the PR; one review per milestone. |

**Recommendation: A now, C once you create a private GitHub repo and add the remote** (your approval for the remote, each push and each merge, per hard rule 6). Then turn on branch protection with `verify` as a required check.

### D6 · Phase naming

**Recommendation:** "Phase 0–4" = the sources' E0–E4. Phase 1 is delivered as factory milestones **M1, M2, …** with task IDs `T<milestone>.<n>`; spikes keep S1–S12; rules are X1–X11 and P1–P12. Phase 0 spikes that still matter become **M0**. Suggested split of Phase 1 (≈ 51 ideal days in 17 §9): M1 vertical slice (17 §10), M2 tracker and status events, M3 duplicates, M4 reminders, M5 export/import/encrypted backup, M6 insight, first-run, "what is stored", accessibility and alpha. Final split comes from `/plan-feature`.
**Consequence:** sources' "E1" text is read as Phase 1 everywhere in this repo.

### D7 · Brand

**Recommendation: adopt, with two changes.**
- `extension.config.json` stays the root (the factory regenerates `src/shared/product.ts` from it). `src/core/brand.ts` re-exports `BRAND_NAME` from it and holds `PLATFORM_DOMAIN = null` until decision #1 (domain) is made; the local edition never contacts it (X1), it is only for user-opened links later.
- `_locales/en/messages.json` holds the store title and description. To avoid drift, generate it from the config at build, or have check-dist assert they match. **check-dist must resolve `__MSG_*__` before its 75/12/132-character checks**, or the checks pass on the placeholder string.
- G6 fails the build if `dist/` contains "JobPilot" (case-insensitive).
- **Consequence:** the name is a one-line change. Today three names are in play (C1); the store title needs #22 before any listing, including the unlisted alpha.

### D8 · Open owner decisions Phase 1 depends on

| # | Decision | Default | Phase 1 can proceed on the default? |
|---|---|---|---|
| 22 | Extension name and store title | "Hearback: Job Application Tracker and CV Check" if it clears | **Code: yes** (D7 isolates it). **Alpha upload: no**, needs the name. |
| 23 | "Free for life" wording | 16 §1 wording, solicitor reads it | Yes. Blocks listing copy only. |
| 24 | LinkedIn/Indeed/Glassdoor policy | ADR 0008 (no scripts, URL/title/paste only) | Yes; it is the stricter option and drives G2. Recommend approve. |
| 26 | Publisher identity | Dedicated account with hardware keys now; trader status after incorporation (#15) | Code: yes. Alpha upload needs the account. Owner action. |
| 27 | Platform re-baseline | 13 Sep 2027 internal target only | Yes; no code impact here. Sources list it as a gate (C13): please answer or waive. |
| 31 | At-rest encryption | Encrypted export only | Yes. |
| 32 | Document blobs, optional `unlimitedStorage` | Extracted text only until S10 | Yes (blobs are Phase 2). |
| 33 | Minimum Chrome | 120 (already in the manifest) | Yes. |
| 34 | Monetisation | Free for life | Yes. |
| 35 | In-page hide/highlight scope | Tier A only, per-site opt-in | Yes (Phase 2 feature). |
| 36 | ID scheme | ULID | Yes; own ~30-line generator with `crypto.getRandomValues`, no dependency. |

Also blocking per the sources: approval of docs/16, docs/17, ADR 0007 and ADR 0008 (M13). Answering "approve all defaults above" plus D1–D7 is enough to start `/plan-feature` for M1.

### Other items needing your input

1. ~~Default status list (C8)~~: decided, the brief's six (ADR-021).
2. "Did you apply?" (C5): click-triggered variant in Phase 1, or defer.
3. Stage odds and "Should I move?" need `content/hiring_stages.json` and the self-check logic (M3, M4): send them, or move these to a later milestone.
4. Design surfaces (M2): send the canvas link or screens, or approve building Phase 1 from `design/tokens.json` plus the written behaviour in 16/17.
5. New dev dependencies for gates: `@axe-core/playwright` (G7), a licence checker (G11).
