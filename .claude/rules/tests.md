---
paths:
  - "tests/unit/**"
  - "vitest.config.ts"
---
# unit tests
- Vitest, Node environment by default; add `// @vitest-environment jsdom` for DOM tests.
- Test pure logic directly; fake only the chrome APIs a test needs (see `tests/unit/fake-storage.ts` if present).
- Never delete or weaken a test to make the gate pass.
