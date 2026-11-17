// Message router for the background service worker. Modules register handlers with `on()`.
// Rules: ignore messages from other extensions or web pages, validate before handling, always reply
// with a Reply<T>, and keep no state in memory (the worker can stop at any time).
import { isOwnSender, type Reply } from "../shared/messages";
import { errorText, isRecord } from "../shared/validate";

type Sender = chrome.runtime.MessageSender;
type Entry = { validate: (m: unknown) => boolean; handle: (m: never, sender: Sender) => unknown };

const handlers = new Map<string, Entry>();

export function on<M extends { type: string }>(type: M["type"], validate: (m: unknown) => m is M, handle: (m: M, sender: Sender) => unknown): void {
  if (handlers.has(type)) throw new Error(`duplicate handler for "${type}"`);
  handlers.set(type, { validate, handle: handle as Entry["handle"] });
}

/** Routes one message. Returns a promise of the reply, or null when the message is ignored. */
export function route(msg: unknown, sender: Sender, runtimeId: string): Promise<Reply<unknown>> | null {
  if (!isOwnSender(sender, runtimeId)) return null;
  if (!isRecord(msg) || typeof msg.type !== "string") return null;
  const entry = handlers.get(msg.type);
  if (!entry || !entry.validate(msg)) return null;
  return Promise.resolve()
    .then(() => entry.handle(msg as never, sender))
    .then(
      (data): Reply<unknown> => ({ ok: true, data: data ?? null }),
      (err: unknown): Reply<unknown> => ({ ok: false, error: errorText(err) })
    );
}

export function startRouter(): void {
  chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
    const reply = route(msg, sender, chrome.runtime.id);
    if (!reply) return false;
    void reply.then(sendResponse);
    return true; // async response
  });
}

/** For tests only. */
export function _resetHandlers(): void {
  handlers.clear();
}
