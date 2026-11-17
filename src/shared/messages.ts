// Typed messages between the background service worker and extension pages or injected scripts.
// Every message is a plain object with a string `type`. The background router (src/background/router.ts)
// only answers messages from this extension, and only after the handler's validator accepts them.
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
