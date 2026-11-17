// The page script's answer to CAPTURE_JOB (SPEC §3 F2). Read-only: never changes the page (X4: runs
// only when the worker asks, after the user's click). Pure apart from reading `doc`.
import { captureDraft } from "../adapters/index";
import { isX3Url } from "../page-inject/reasons";
import { CaptureJobSchema, isOwnSender, type CaptureJobReply } from "../shared/messages";

/**
 * The reply for a message, or null to ignore it. Only CAPTURE_JOB from this extension's service worker
 * is answered: other extensions and other tabs' content scripts (they carry `sender.tab`) are ignored.
 */
export function answerCapture(msg: unknown, sender: { id?: string | undefined; tab?: unknown }, runtimeId: string, doc: Document, href: string): CaptureJobReply | null {
  if (!isOwnSender(sender, runtimeId) || sender.tab !== undefined) return null;
  const req = CaptureJobSchema.safeParse(msg);
  if (!req.success) return null;
  // The worker never injects on X3 sites; if the page navigated there anyway, read nothing.
  if (isX3Url(href)) return { draft: null };
  try {
    return { draft: captureDraft(doc, href, { id: req.data.id, now: req.data.now }) };
  } catch {
    return { draft: null }; // captureDraft doesn't throw on page data; this is belt and braces
  }
}
