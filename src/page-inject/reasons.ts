// Why a page can't be scripted, and what to tell the user. Pure and DOM-free.
// Chrome hides tab URLs on its own pages, so the injection error text is the main signal.
export const REASONS = ["restricted", "pdf", "file", "no-access", "blocked"] as const;
export type Reason = (typeof REASONS)[number];

const RESTRICTED_PREFIXES = ["chrome://", "chrome-extension://", "chrome-untrusted://", "edge://", "about:", "view-source:", "devtools://", "data:", "https://chrome.google.com/webstore", "https://chromewebstore.google.com"];

export function isRestrictedUrl(url: string | undefined): boolean {
  return !!url && RESTRICTED_PREFIXES.some((p) => url.startsWith(p));
}

export function isFileUrl(url: string | undefined): boolean {
  return !!url && url.toLowerCase().startsWith("file:");
}

export function isPdfUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

/** Before injecting: a reason the URL alone proves, or null to go ahead and try. */
export function reasonFromUrl(url: string | undefined, fileAccessAllowed: boolean): Reason | null {
  if (!url) return null;
  if (isRestrictedUrl(url)) return "restricted";
  if (isFileUrl(url) && !fileAccessAllowed) return "file";
  if (isPdfUrl(url)) return "pdf";
  return null;
}

const RESTRICTED_ERR = /cannot access an? [a-z][a-z0-9+.-]*:\/\/ url|extensions gallery cannot be scripted|cannot be scripted due to an extensions? policy/i;
const NO_ACCESS_ERR = /cannot access contents of (the )?(page|url)|must request permission to access|missing host permission/i;
const FILE_ERR = /file:\/\//i;

/** After a failed injection. `url` is often undefined (Chrome hides it without a grant). */
export function reasonFromError(message: string, url: string | undefined, fileAccessAllowed: boolean): Reason {
  if (RESTRICTED_ERR.test(message)) return "restricted";
  if (FILE_ERR.test(message) || isFileUrl(url)) return fileAccessAllowed ? "blocked" : "file";
  if (NO_ACCESS_ERR.test(message)) return "no-access";
  return reasonFromUrl(url, fileAccessAllowed) ?? "blocked";
}

export function explain(reason: Reason): string {
  switch (reason) {
    case "restricted":
      return "Chrome doesn't let extensions run on this page (browser pages, the Web Store and similar).";
    case "pdf":
      return "This is a PDF in Chrome's viewer, where extensions can't run.";
    case "file":
      return "To use this on local files, turn on \"Allow access to file URLs\" for the extension in chrome://extensions.";
    case "no-access":
      return "No access to this tab yet. Click the extension's toolbar icon on the page, then try again.";
    case "blocked":
      return "This page blocked the extension. Reload the page and try again.";
  }
}
