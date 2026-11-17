# Architecture: JobSearch Pal

*Short and current. Big changes need an ADR in DECISIONS.md and the owner's approval.*

- **Contexts:** background service worker (`src/background/`), plus script injected on demand into the current page (`src/page/`).
- **Messaging:** typed messages (`src/shared/messages.ts`) handled by the router (`src/background/router.ts`),
  which ignores other senders and validates every message before a handler runs.
- **Data:** everything read back is validated (`src/shared/validate.ts`, module parsers).
- **Permissions:** [activeTab, scripting, storage, sidePanel, alarms, notifications] (ADR-006), enforced after every build.
- **Modules:** e2e-playwright, page-inject, storage (factory 0.4.0). Details in `docs/REPO-MAP.md`.
