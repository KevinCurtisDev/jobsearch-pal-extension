// Pure domain logic (ADR-005, SPEC §6 G3). No chrome, window, document or browser-only modules here:
// ESLint (src/core block) and `tsc -p tsconfig.core.json` (lib ES2023, no DOM or chrome types) enforce it.
// Callers in background/side panel pass data in and apply results.

/** Version of the core module's public contract; bump when exported shapes change. */
export const CORE_VERSION = 1;

export * from "./ulid";
export * from "./model";
export * from "./projection";
export * from "./jsonld";
export * from "./draft";
