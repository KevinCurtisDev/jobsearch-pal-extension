// Zod at the boundaries (ADR-004, hard rule 4). Loading this module switches Zod to jitless, so Zod never
// probes `new Function` (the MV3 CSP reports it as a violation even when the throw is caught). Any module
// that uses Zod imports "zod/mini" (smaller bundle) and also imports this module.
import * as z from "zod/mini";

z.config({ jitless: true });

export type Guard<T> = (v: unknown) => v is T;

/** A type guard that accepts exactly what `schema` parses. Never throws. */
export function guard<S extends z.ZodMiniType>(schema: S): Guard<z.infer<S>> {
  return (v: unknown): v is z.infer<S> => schema.safeParse(v).success;
}

/** Core message: a health check (no other fields allowed). */
export const PingSchema = z.strictObject({ type: z.literal("ping") });
export const isPingMessage = guard(PingSchema);
