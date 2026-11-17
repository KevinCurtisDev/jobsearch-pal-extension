---
paths:
  - "tests/e2e/**"
  - "playwright.config.ts"
---
# e2e-playwright module
- Use the fixtures in `tests/e2e/fixtures.ts`: `clickAction(page)`, `openPopup(page)` (real popup via CDP), `sw`, `origin`.
- Give every test page a unique URL (`?name`); the action click finds the tab by URL.
- Run with `npm run test:e2e` (builds first). Report Chromium results separately from manual Chrome checks.
