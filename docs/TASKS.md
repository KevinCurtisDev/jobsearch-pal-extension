# Tasks: JobSearch Pal

*Active milestone only; move finished milestones to `docs/archive/`. Each task fits one session and
lists the files it touches, so Claude reads only those. Helper: `node scripts/tasks.ts list | next | show T1.1 | check`.*

## Milestones
| ID | Goal | Status |
|---|---|---|
| M0 | Gates and platform: six-permission budget, side panel shell, Dexie and Zod, pure `src/core`, brand module, network/brand/licence gates, offline e2e | planned |
| M1 | Checkpoint A: vertical slice (`docs/source/17` §10) | not planned |

**M0 exit criteria:** `npm run verify` green with the new gates, each with a fixture proving it fails when it should; `npm run test:e2e` green including the offline run; toolbar-click capture still works; owner's manual check in Chrome passes.

## M0: Gates and platform

### T0.1 src/core purity gate `[x]`
- **Goal:** `src/core` cannot use `chrome`, `window`, `document` or browser-only modules; lint and typecheck both enforce it.
- **Files:** `eslint.config.js`, `tsconfig.core.json`, `package.json`, `src/core/index.ts`, `tests/unit/core-purity.test.ts`
- **Depends on:** none
- **Spec:** §6 G3
- **Done when:** an ESLint block for `src/core/**` adds restricted globals and imports (adds rules only); `npm run typecheck` also runs `tsc -p tsconfig.core.json --noEmit` (lib ES2023, no DOM or chrome types); a unit test lints a `src/core/` fixture using `chrome.` and expects an error; `npm run verify` green
- **Manual check:** none

### T0.2 Network audit gate (G1) `[x]`
- **Goal:** `check-dist` fails on network APIs and unlisted external URLs in built JS, HTML, CSS and JSON.
- **Files:** `scripts/dist-rules.ts`, `scripts/check-dist.ts`, `scripts/network-allow.json`, `tests/unit/dist-rules.test.ts`, `tests/fixtures/network/bad-bundle.js`
- **Depends on:** none
- **Spec:** §6 G1
- **Done when:** the scan detects `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, remote `import()` and any `http(s)://` string not in the allowlist; allowlist entries are exact strings, each with a reason, and the loader rejects wildcard or pattern entries (unit test); the bad fixture fails with one message per hit and a clean fixture passes; current `dist/` passes; `npm run verify` green
- **Manual check:** none

### T0.3 Brand module, locales and brand scan (G6) `[x]`
- **Goal:** brand strings live only in `src/core/brand.ts` and `_locales/en/messages.json` (ADR-011), and the old names cannot ship.
- **Files:** `src/core/brand.ts`, `_locales/en/messages.json`, `src/manifest.json`, `build.json`, `scripts/dist-rules.ts`, `scripts/check-dist.ts`, `tests/unit/brand.test.ts`, `tests/unit/manifest.test.ts`, `tests/e2e/smoke.spec.ts`
- **Depends on:** T0.1
- **Spec:** §6 G6
- **Done when:** `brand.ts` exports `BRAND_NAME` (from `PRODUCT.name`), `STORE_TITLE`, `PLATFORM_DOMAIN = "jobsearchpal.com"`; `messages.json` has `extName` "JobSearch Pal: Job Application Tracker", `extShortName`, `extDescription`; manifest uses `__MSG_*__` with `default_locale: "en"` and `_locales` is copied to `dist/`; `check-dist` resolves messages before the 75/12/132 length checks and requires `extName` to start with the config `name`; the brand scan fails on "jobpilot", "hearback", "offerlight" (case-insensitive) in `dist/` and shipped source, with a fixture proving it; smoke e2e resolves the localized name; `npm run verify` green
- **Manual check:** `chrome://extensions` shows "JobSearch Pal: Job Application Tracker"

### T0.4 Permission budget and side panel shell `[x]`
- **Goal:** apply ADR-006 and add a side panel that the toolbar icon opens while toolbar capture keeps working (ADR-012, option A).
- **Files:** `extension.config.json`, `src/manifest.json`, `build.json`, `build.mjs`, `public/sidepanel.html`, `src/sidepanel/main.ts`, `src/ui/tokens.css`, `scripts/tokens-css.ts`, `src/page-inject/background.ts`, `scripts/dist-rules.ts`, `tests/unit/manifest.test.ts`, `tests/unit/dist-rules.test.ts`, `tests/e2e/sidepanel.spec.ts`, `CLAUDE.md`, `docs/SPEC.md`, `docs/PRIVACY.md`, `docs/STORE_LISTING.md`, `docs/REPO-MAP.md`
- **Depends on:** T0.3
- **Spec:** §3 F1, §5
- **Done when:** budget and manifest list the six permissions, `side_panel.default_path` is set and the manifest has no `default_popup` (unit test); `referencedFiles` includes the side panel path (G4, unit test); the worker calls `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })`; the `action.onClicked` handler calls `chrome.sidePanel.open({ tabId })` first, with no `await` before it, then `activateTab` (errors from `open` caught and logged); CLAUDE.md hard rule 1, PRIVACY.md and STORE_LISTING.md justifications updated; panel built with `createElement`, styled only by CSS variables generated from `design/tokens.json` at build time, no hex values in `src/sidepanel` or `src/ui`; existing inject e2e still passes; new e2e opens `sidepanel.html` and sees the brand name; `npm run verify` green
- **Manual check:** clicking the icon on a job page opens the side panel and the page capture still runs

### T0.5 Dexie and Zod, pinned and licence-checked `[ ]`
- **Goal:** add both runtime dependencies at exact versions and prove they bundle through every gate.
- **Files:** `package.json`, `package-lock.json`, `scripts/licence-check.ts`, `scripts/release-check.ts`, `src/storage/db.ts`, `src/shared/zod-guard.ts`, `src/background/index.ts`, `tests/unit/licence-check.test.ts`, `tests/unit/router.test.ts`, `tests/e2e/db.spec.ts`, `docs/REPO-MAP.md`
- **Depends on:** T0.2, T0.4
- **Spec:** §5, §6
- **Done when:** `package.json` lists `"dexie": "4.4.7"` and `"zod": "4.6.7"` exactly (no `^` or `~`; unit test asserts every dependency version is exact); `scripts/licence-check.ts` (no new dependency) fails on any production dependency outside MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD and runs in `verify`; `npm audit --omit=dev` runs in `release-check`; `src/storage/db.ts` opens `jobsearch-pal` v1 with one `meta` store; `ping` is validated with Zod via `zod-guard.ts`; the bundle passes `bannedCode` and G1 without loosening either (if Zod's eval probe trips, use `jitless` or `zod/mini`; any library URL string is added as an exact allowlist entry with a reason, after the owner sees it); e2e round-trips one `meta` row in the worker; `npm run verify` green
- **Manual check:** none

### T0.6 Offline e2e smoke `[ ]`
- **Goal:** prove the extension makes no network requests while its main flows run.
- **Files:** `tests/e2e/offline.spec.ts`, `tests/e2e/fixtures.ts`, `package.json`
- **Depends on:** T0.5
- **Spec:** §6
- **Done when:** every request other than the local test origin and `chrome-extension://` is aborted and recorded (including service-worker requests, or a documented equivalent check); worker start, opening `sidepanel.html` and toolbar capture on `basic.html` record zero external requests; S12 result recorded as "tested"; `npm run test:e2e` green
- **Manual check:** none
