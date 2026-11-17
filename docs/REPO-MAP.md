# Repository map: JobSearch Pal

*Where things live. Keep it current when you add a folder.*

| Path | What it is |
|---|---|
| `extension.config.json` | Product identity, modules, permission budget, factory version (source of truth) |
| `src/manifest.json` | Manifest V3 (version must match `package.json`); names are `__MSG_*__` placeholders |
| `_locales/en/messages.json` | Localized extension name, short name, description (ADR-011) |
| `src/core/brand.ts` | `BRAND_NAME`, `STORE_TITLE`, `PLATFORM_DOMAIN`: the only brand strings in code (ADR-011) |
| `src/core/ulid.ts`, `model.ts`, `projection.ts` | ULIDs (injected clock/random), Zod schemas (JobDraft, Job, Application, ApplicationEvent, Pay), `applyEvent` / `rebuildProjections` |
| `src/core/draft.ts` | `manualDraft(url, title, deps)`: URL-only draft (F3, manual fallback) |
| `src/core/jsonld.ts` | JSON-LD `JobPosting` → fields with provenance (`extractJobPosting`), `htmlToText` (no DOM) |
| `src/core/backup.ts` | Backup file (F6, F7): `createBackup`, `readBackup` (size, JSON, format, version, checksum, Zod), `planImport` (merge by id), `canonicalJson`; SHA-256 injected |
| `src/adapters/` | Capture (ADR-005): index.ts `captureDraft(document, url, deps)` (JSON-LD, then adapters, else manual draft), greenhouse.ts, dom-text.ts |
| `tests/fixtures/pages/` | Synthetic HTML pages for adapter/JSON-LD unit tests (loaded with jsdom via `tests/unit/fixture-doc.ts`) |
| `src/background/index.ts` | Service worker wiring; registers message handlers |
| `src/background/router.ts` | Message router: sender check, validation, replies |
| `src/background/save.ts` | SAVE_JOB handler: Zod v1 union, extension pages only, calls `saveJob`, replies `{ jobId }` |
| `src/background/modules.ts` | Generated list of module background entry points |
| `src/shared/messages.ts` | Message types, `send()`, sender checks |
| `src/shared/validate.ts` | Validators for untrusted data |
| `src/shared/zod-guard.ts` | Sets Zod jitless (import it wherever `zod/mini` is used); `guard(schema)`, `PingSchema` (ADR-004) |
| `src/storage/db.ts` | Dexie database `jobsearch-pal` (v1: `meta` store); rows validated with Zod on read |
| `tests/e2e/` | Playwright e2e: fixtures.ts (extension loading, action click, real popup driver, `net` offline guard), offline.spec.ts (zero external requests), pages/ (local test pages), *.spec.ts |
| `src/page-inject/` | Capture pipeline in the service worker: activate.ts (X3/URL checks, probe, inject, CAPTURE_JOB to frame 0), reasons.ts (`isX3Host`, reasons), report.ts (`TabDraft` schema), report-store.ts (`draft.<tabId>` in storage.session), background.ts (toolbar click, tab close) |
| `src/sidepanel/main.ts`, `public/sidepanel.html` | Side panel (ADR-012): opened by the toolbar click; follows the active tab's `draft.<tabId>`, reads Dexie directly for the list |
| `src/sidepanel/review.ts`, `list.ts`, `dom.ts` | Review form (`draftFromForm`: edits become `manual` provenance), saved jobs list, `el()` (createElement + textContent) |
| `src/ui/tokens.css` | Base UI styles for extension pages; only `var(--…)` from the generated `dist/tokens.css`, no hex values |
| `design/tokens.json`, `scripts/tokens-css.ts` | Design tokens; the build turns them into CSS variables (`dist/tokens.css`) |
| `src/page/` | Script injected into pages (isolated world, changes nothing): main.ts handle + CAPTURE_JOB listener, collect.ts `answerCapture` (sender check, Zod, `captureDraft`) |
| `src/storage/jobs.ts`, `src/storage/backup.ts` | jobs.ts: the only writer of jobs/applications/events (`saveJob`, `importBackup`), `listJobs`; backup.ts: `readBackupData` (export), `previewImport` (dry-run) |
| `src/sidepanel/backup.ts` | Back up and restore section: export download, file import with dry-run and confirm |
| `src/storage/store.ts` | Typed storage keys: defineKey, read, write, remove, watch (storage module) |
| `build.mjs`, `build.json` | esbuild bundling; entry points and static files |
| `scripts/check-dist.ts`, `scripts/dist-rules.ts` | Post-build gate: permissions, CSP, locales, files, no remote code, G1 network (`scripts/network-allow.json`), G6 brand scan |
| `scripts/licence-check.ts` | Licence gate (in `verify`): allowed runtime licences, exact versions (ADR-014) |
| `scripts/package.ts` | Deterministic store zip into `release/` |
| `scripts/measure.ts` | Instruction size and gate timing report |
| `tests/unit/` | Vitest unit tests |
| `docs/` | Brief, spec, tasks, decisions, progress |
| `.claude/` | Claude Code settings, skills and path-scoped rules |
