# Repository map: JobSearch Pal

*Where things live. Keep it current when you add a folder.*

| Path | What it is |
|---|---|
| `extension.config.json` | Product identity, modules, permission budget, factory version (source of truth) |
| `src/manifest.json` | Manifest V3 (version must match `package.json`) |
| `src/background/index.ts` | Service worker wiring; registers message handlers |
| `src/background/router.ts` | Message router: sender check, validation, replies |
| `src/background/modules.ts` | Generated list of module background entry points |
| `src/shared/messages.ts` | Message types, `send()`, sender checks |
| `src/shared/validate.ts` | Validators for untrusted data |
| `tests/e2e/` | Playwright e2e: fixtures.ts (extension loading, action click, real popup driver), pages/ (local test pages), *.spec.ts |
| `src/page-inject/` | Injection pipeline in the service worker: activate.ts (probe, inject, classify), reasons.ts, background.ts (handlers) |
| `src/page/` | Script injected into pages (isolated world): main.ts creates the handle, view.ts shows results |
| `src/storage/store.ts` | Typed storage keys: defineKey, read, write, remove, watch (storage module) |
| `build.mjs`, `build.json` | esbuild bundling; entry points and static files |
| `scripts/check-dist.ts`, `scripts/dist-rules.ts` | Post-build gate: permissions, CSP, files, no remote code |
| `scripts/package.ts` | Deterministic store zip into `release/` |
| `scripts/measure.ts` | Instruction size and gate timing report |
| `tests/unit/` | Vitest unit tests |
| `docs/` | Brief, spec, tasks, decisions, progress |
| `.claude/` | Claude Code settings, skills and path-scoped rules |
