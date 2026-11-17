import { defineConfig } from "vitest/config";

// Unit tests run in Node by default. A test that needs a DOM starts with `// @vitest-environment jsdom`
// (only modules that need it add jsdom).
export default defineConfig({
  define: { __DEV__: "true" },
  test: { include: ["tests/unit/**/*.test.ts"] }
});
