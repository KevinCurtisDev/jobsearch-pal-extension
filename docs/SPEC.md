# Spec: JobSearch Pal

*Source of truth for what the extension does. Short, numbered, testable. Update it before changing behaviour.*

## 1. Summary
Save job posts from the page you're on, track each application's status, set reminders, back up and export. Free and local-only.

## 2. Users and main flow
⟨Planned with M1 (vertical slice, `docs/source/17` §10).⟩

## 3. Features (each must be testable)
- **F1 Side panel shell (M0):** clicking the toolbar icon opens the side panel on the current tab, and page capture still runs on the same click. The panel shows the brand name and an empty state, built with `createElement` and styled only with CSS variables generated from `design/tokens.json`. The manifest has no `default_popup`.

## 4. Later (not in Phase 1)
- In-page filtering, CV import, matching, autofill, interview centre, recruiter CRM, analytics beyond stage odds (`docs/BUILD-PROMPT.md` §4).
- Full-text search with MiniSearch (ADR-004).

## 5. Permissions, storage and privacy
- Permission budget: [activeTab, scripting, storage, sidePanel, alarms, notifications] (ADR-006, applied in T0.4: manifest, `extension.config.json`, check-dist). No host permissions, no content scripts. `unlimitedStorage` only as optional, after spike S10. Minimum Chrome 120. Any change needs an ADR.
- Records live in IndexedDB through Dexie; `chrome.storage` holds small settings only (ADR-004). Zod validates every boundary.
- Data stays on the device. No network requests, analytics or remote code (X1, X2).

## 6. Security rules and gates
- No HTML sinks; build DOM with createElement + textContent. Validate everything read from storage, messages and files.
- **G1 network audit:** `check-dist` fails on `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, remote `import()` and any `http(s)://` string in built JS, HTML, CSS or JSON that is not in `scripts/network-allow.json`. Allowlist entries are exact strings, each with a reason; no wildcards or patterns.
- **G3 core purity:** `src/core` uses no `chrome`, `window`, `document` or browser-only modules (ESLint block + `tsconfig.core.json`).
- **G4:** `check-dist` checks the side panel file exists.
- **G6 brand scan:** "jobpilot", "hearback", "offerlight" (case-insensitive) fail the build if found in `dist/` or shipped source (`src/`, `public/`, `_locales/`, `build.json`, `extension.config.json`). `docs/` is not scanned.
- **Licences:** runtime dependencies limited to MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD (`scripts/licence-check.ts` in `verify`). `npm audit --omit=dev` runs in `release-check`.
- **Offline e2e:** the main flows make zero external requests (`tests/e2e/offline.spec.ts`).

## 7. Non-goals (M0)
- No data model or capture changes; no Save button in the side panel (M1, after spike S13).
- No axe tests yet (needs a dev-dependency approval); no bundle budgets yet (set after M1).
