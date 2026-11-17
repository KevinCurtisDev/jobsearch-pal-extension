// Small, dependency-free validators. Everything read from storage, messages or imports is untrusted:
// check it with these (or a module's own parser) before use, and treat a failed check as "absent".

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A string of at most `max` characters (default 1000). */
export function isShortString(v: unknown, max = 1000): v is string {
  return typeof v === "string" && v.length <= max;
}

export function isIntInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

export function isOneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}

/** Truncates an error (or anything thrown) to a short, safe string for replies and logs. */
export function errorText(err: unknown, max = 200): string {
  const s = err instanceof Error ? err.message : String(err);
  return s.slice(0, max);
}
