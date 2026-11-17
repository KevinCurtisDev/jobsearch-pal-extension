import { describe, expect, it } from "vitest";
import { createUlid } from "../../src/core/ulid";
import { ApplicationSchema, type Application, type ApplicationEvent, type Status } from "../../src/core/model";
import { applyEvent, rebuildProjections } from "../../src/core/projection";

/** A tiny seeded PRNG so shuffles are reproducible. */
function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * Simulates the writer: appends events in creation order and keeps stored `applications` rows up to date
 * with `applyEvent`, the way the storage module will.
 */
function simulate(seed: number) {
  const rand = prng(seed);
  let t = Date.UTC(2026, 10, 17);
  const ulid = createUlid({ now: () => t, random: (b) => b.map(() => Math.floor(rand() * 256)) });
  const statuses: Status[] = ["saved", "applied", "interviewing", "offer", "rejected", "withdrawn"];
  const log: ApplicationEvent[] = [];
  const stored = new Map<string, Application>();
  const apps: { id: string; jobId: string }[] = [];
  for (let i = 0; i < 200; i++) {
    if (rand() < 0.7) t += Math.floor(rand() * 3 * 86_400_000); // sometimes several events in one ms
    const at = new Date(t).toISOString();
    let e: ApplicationEvent;
    const app = apps[Math.floor(rand() * apps.length)];
    if (!app || rand() < 0.25) {
      const created = { id: ulid(), jobId: ulid() };
      apps.push(created);
      e = { id: ulid(), applicationId: created.id, jobId: created.jobId, at, type: "created", status: "saved" };
    } else {
      const status = statuses[Math.floor(rand() * statuses.length)] ?? "saved";
      e = { id: ulid(), applicationId: app.id, jobId: app.jobId, at, type: "status_changed", status };
    }
    log.push(e);
    const next = applyEvent(stored.get(e.applicationId), e);
    if (next) stored.set(e.applicationId, next);
  }
  return { log, stored, rand };
}

const ev = (id: string, type: "created" | "status_changed", status: Status, at: string): ApplicationEvent => ({
  id,
  applicationId: "01JD00000000000000000000AA",
  jobId: "01JD00000000000000000000JB",
  at,
  type,
  status,
});

describe("rebuildProjections (X11, F5)", () => {
  it("matches the stored projections for many simulated logs", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { log, stored } = simulate(seed);
      const rebuilt = rebuildProjections(log);
      expect(rebuilt).toEqual(stored);
      for (const row of rebuilt.values()) expect(ApplicationSchema.safeParse(row).success).toBe(true);
    }
  });

  it("is independent of input order and duplicate events (import idempotency)", () => {
    const { log, stored, rand } = simulate(42);
    const shuffled = [...log, ...log.slice(0, 50)];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j] as ApplicationEvent, shuffled[i] as ApplicationEvent];
    }
    expect(rebuildProjections(shuffled)).toEqual(stored);
  });

  it("projects status, appliedAt (first time applied, UTC date) and timestamps", () => {
    const rows = rebuildProjections([
      ev("01JD00000000000000000000A1", "created", "saved", "2026-11-01T09:00:00.000Z"),
      ev("01JD00000000000000000000A2", "status_changed", "applied", "2026-11-03T23:30:00.000Z"),
      ev("01JD00000000000000000000A3", "status_changed", "interviewing", "2026-11-10T08:00:00.000Z"),
      ev("01JD00000000000000000000A4", "status_changed", "applied", "2026-11-12T08:00:00.000Z"),
    ]);
    expect([...rows.values()]).toEqual([
      {
        id: "01JD00000000000000000000AA",
        jobId: "01JD00000000000000000000JB",
        status: "applied",
        appliedAt: "2026-11-03",
        createdAt: "2026-11-01T09:00:00.000Z",
        updatedAt: "2026-11-12T08:00:00.000Z",
      },
    ]);
  });

  it("ignores status changes before creation and a second created event", () => {
    const orphan = rebuildProjections([ev("01JD00000000000000000000A1", "status_changed", "offer", "2026-11-01T09:00:00.000Z")]);
    expect(orphan.size).toBe(0);
    const twice = rebuildProjections([
      ev("01JD00000000000000000000A1", "created", "saved", "2026-11-01T09:00:00.000Z"),
      ev("01JD00000000000000000000A2", "created", "applied", "2026-11-02T09:00:00.000Z"),
    ]);
    expect(twice.get("01JD00000000000000000000AA")?.status).toBe("saved");
    expect(rebuildProjections([]).size).toBe(0);
  });
});
