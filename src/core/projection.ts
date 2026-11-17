// Projections from the event log (X11, F5; source 17 §3.2). `applyEvent` is what a writer uses to update
// a stored `applications` row; `rebuildProjections` folds the whole log and must give the same rows.
import type { Application, ApplicationEvent } from "./model";

/**
 * The next projection of one application after `event`. Returns `prev` unchanged for events that do not
 * apply: a second `created`, or a `status_changed` before any `created`.
 */
export function applyEvent(prev: Application | undefined, event: ApplicationEvent): Application | undefined {
  if (event.type === "created") {
    if (prev) return prev;
    return {
      id: event.applicationId,
      jobId: event.jobId,
      status: event.status,
      appliedAt: event.status === "applied" ? event.at.slice(0, 10) : null,
      createdAt: event.at,
      updatedAt: event.at,
    };
  }
  if (!prev) return prev;
  return {
    ...prev,
    status: event.status,
    appliedAt: prev.appliedAt ?? (event.status === "applied" ? event.at.slice(0, 10) : null),
    updatedAt: event.at,
  };
}

/**
 * Rebuilds every application row from the log. Order is by event id (ULIDs sort by time); duplicate
 * event ids count once, so re-imported events change nothing.
 */
export function rebuildProjections(events: readonly ApplicationEvent[]): Map<string, Application> {
  const byId = new Map<string, ApplicationEvent>();
  for (const e of events) if (!byId.has(e.id)) byId.set(e.id, e);
  const ordered = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out = new Map<string, Application>();
  for (const e of ordered) {
    const next = applyEvent(out.get(e.applicationId), e);
    if (next) out.set(e.applicationId, next);
  }
  return out;
}
