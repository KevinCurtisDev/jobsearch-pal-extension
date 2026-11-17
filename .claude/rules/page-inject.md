---
paths:
  - "src/page-inject/**"
  - "src/page/**"
---
# page-inject module
- `src/page/` runs in the page's isolated world: read the DOM, never change page content (unless the spec says so and an ADR approves it), never inject into the main world, never use `postMessage` to the page.
- What the page reports is defined in `src/page-inject/report.ts` (type + `parseReport`). Change both together and keep limits on every string and number.
- Functions passed to `executeScript({ func })` must be self-contained (no imports or outer variables).
- Activation goes through `activateTab()` only (per-tab queue, toggle on repeat, failure reasons). New failure cases get a reason and an `explain()` text.
- activeTab ends when the tab navigates; never add host permissions to work around it without the owner's approval.
