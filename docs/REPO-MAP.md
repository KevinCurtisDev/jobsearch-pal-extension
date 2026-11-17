# Repository map: JobSearch Pal

*Where things live. Keep it current when you add a folder.*

| Path | What it is |
|---|---|
| `extension.config.json` | Product identity, modules, permission budget, factory version (source of truth) |
| `src/manifest.json` | Manifest V3 (version must match `package.json`); names are `__MSG_*__` placeholders |
| `_locales/en/messages.json` | Localized extension name, short name, description (ADR-011) |
| `src/core/brand.ts` | `BRAND_NAME`, `STORE_TITLE`, `PLATFORM_DOMAIN`: the only brand strings in code (ADR-011) |
| `src/background/index.ts` | Service worker wiring; registers message handlers |
| `src/background/router.ts` | Message router: sender check, validation, replies |
| `src/background/modules.ts` | Generated list of module background entry points |
| `src/shared/messages.ts` | Message types, `send()`, sender checks |
| `src/shared/validate.ts` | Validators for untrusted data |
| `src/shared/zod-guard.ts` | Sets Zod jitless (import it wherever `zod/mini` is used); `guard(schema)`, `PingSchema` (ADR-004) |
| `src/storage/db.ts` | Dexie database `jobsearch-pal` (v1: `meta` store); rows validated with Zod on read |
| `tests/e2e/` | Playwright e2e: fixtures.ts (extension loading, action click, real popup driver), pages/ (local test pages), *.spec.ts |
| `src/page-inject/` | Injection pipeline in the service worker: activate.ts (probe, inject, classify), reasons.ts, background.ts (handlers) |
| `src/sidepanel/main.ts`, `public/sidepanel.html` | Side panel (ADR-012): opened by the toolbar click; built with createElement |
| `src/ui/tokens.css` | Base UI styles for extension pages; only `var(--…)` from the generated `dist/tokens.css`, no hex values |
| `design/tokens.json`, `scripts/tokens-css.ts` | Design tokens; the build turns them into CSS variables (`dist/tokens.css`) |
| `src/page/` | Script injected into pages (isolated world): main.ts creates the handle, view.ts shows results |
| `src/storage/store.ts` | Typed storage keys: defineKey, read, write, remove, watch (storage module) |
| `build.mjs`, `build.json` | esbuild bundling; entry points and static files |
| `scripts/check-dist.ts`, `scripts/dist-rules.ts` | Post-build gate: permissions, CSP, locales, files, no remote code, G1 network (`scripts/network-allow.json`), G6 brand scan |
| `scripts/licence-check.ts` | Licence gate (in `verify`): allowed runtime licences, exact versions (ADR-014) |
| `scripts/package.ts` | Deterministic store zip into `release/` |
| `scripts/measure.ts` | Instruction size and gate timing report |
| `tests/unit/` | Vitest unit tests |
| `docs/` | Brief, spec, tasks, decisions, progress |
| `.claude/` | Claude Code settings, skills and path-scoped rules |
