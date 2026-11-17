// What one toolbar click produced for a tab (SPEC §3 F2, F3), as kept in chrome.storage.session and
// read by the side panel. `mode` "page" = read from the page by the page script; "url-only" = tab URL
// and title only, because the site is an X3 site or the page can't be scripted (`reason` says which).
import * as z from "zod/mini";
import "../shared/zod-guard";
import { JobDraftSchema } from "../core/model";
import { REASONS } from "./reasons";

export const TabDraftSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("page"), draft: JobDraftSchema }),
  z.strictObject({ mode: z.literal("url-only"), reason: z.enum(REASONS), draft: JobDraftSchema }),
]);
export type TabDraft = z.infer<typeof TabDraftSchema>;

export function parseTabDraft(v: unknown): TabDraft | null {
  const r = TabDraftSchema.safeParse(v);
  return r.success ? r.data : null;
}
