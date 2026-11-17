// Typed messages between the background service worker and extension pages or injected scripts.
// Every message is a plain object with a string `type`. The background router (src/background/router.ts)
// only answers messages from this extension, and only after the handler's validator accepts them.
import * as z from "zod/mini";
import "./zod-guard";
import { InstantSchema, JobDraftSchema, UlidSchema } from "../core/model";
import { isRecord } from "./validate";

export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

/** Core message: a health check. Reply data: { version } from the manifest. */
export type Ping = { type: "ping" };
export const isPing = (m: unknown): m is Ping => isRecord(m) && m.type === "ping";

/** True when the sender is this extension (its pages, its service worker or scripts it injected). */
export function isOwnSender(sender: { id?: string | undefined }, runtimeId: string): boolean {
  return typeof runtimeId === "string" && runtimeId.length > 0 && sender.id === runtimeId;
}

/**
 * True when the sender is one of this extension's own pages (popup, options; also when opened in a tab),
 * not a script injected into a web page: for injected scripts Chrome reports the web page's URL.
 */
export function isExtensionPage(sender: { id?: string | undefined; url?: string | undefined }, runtimeId: string, extOrigin: string): boolean {
  return isOwnSender(sender, runtimeId) && typeof extOrigin === "string" && extOrigin.startsWith("chrome-extension://") && typeof sender.url === "string" && sender.url.startsWith(extOrigin);
}

export function isReply(v: unknown): v is Reply<unknown> {
  if (!isRecord(v)) return false;
  return (v.ok === true && "data" in v) || (v.ok === false && typeof v.error === "string");
}

/** Sends a message to the background and returns its validated reply (never throws). */
export async function send<T>(msg: { type: string } & Record<string, unknown>): Promise<Reply<T>> {
  try {
    const r: unknown = await chrome.runtime.sendMessage(msg);
    return isReply(r) ? (r as Reply<T>) : { ok: false, error: "no-reply" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "send-failed" };
  }
}

// CAPTURE_JOB (SPEC §3 F2): the only message the worker sends to a page. The worker sends it to the
// top frame (frameId 0) of the tab the user clicked, after the X3 and URL checks; the page script
// answers with the draft it read. The worker picks the draft id and time, and validates the reply
// with these schemas (a reply with another id is refused).

export const CAPTURE_JOB = "CAPTURE_JOB";
export const CaptureJobSchema = z.strictObject({ type: z.literal(CAPTURE_JOB), v: z.literal(1), id: UlidSchema, now: InstantSchema });
export type CaptureJob = z.infer<typeof CaptureJobSchema>;
/** `draft` is null when the page has nothing to save (e.g. a non-http(s) URL). */
export const CaptureJobReplySchema = z.strictObject({ draft: z.nullable(JobDraftSchema) });
export type CaptureJobReply = z.infer<typeof CaptureJobReplySchema>;

/** The validated draft from a CAPTURE_JOB reply, or undefined if the reply is invalid or for another id. */
export function parseCaptureReply(reply: unknown, id: string): CaptureJobReply["draft"] | undefined {
  const r = CaptureJobReplySchema.safeParse(reply);
  if (!r.success) return undefined;
  if (r.data.draft !== null && r.data.draft.id !== id) return undefined;
  return r.data.draft;
}

// SAVE_JOB (SPEC §3 F4, ADR-017): the side panel asks the worker to save a reviewed draft. Versioned by
// `v` (a discriminated union, so a v2 can be added beside v1). Accepted only from extension pages; the
// worker calls `saveJob` and replies with `{ jobId }` only.

export const SAVE_JOB = "SAVE_JOB";
export const SaveJobSchema = z.discriminatedUnion("v", [z.strictObject({ type: z.literal(SAVE_JOB), v: z.literal(1), draft: JobDraftSchema })]);
export type SaveJob = z.infer<typeof SaveJobSchema>;
export const SaveJobReplySchema = z.strictObject({ jobId: UlidSchema });
export type SaveJobReply = z.infer<typeof SaveJobReplySchema>;
