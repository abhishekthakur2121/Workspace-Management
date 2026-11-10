import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { isSuperAdmin, type Actor } from "@/server/access";
import { addDays, type LeaveSpan, type LeaveType } from "@/lib/leave";
import type { Prisma } from "@/generated/prisma/client";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (s: string) => new Date(`${s}T00:00:00Z`);
const person = { select: { id: true, name: true, email: true, image: true } } as const;

const span = (r: { startDate: Date; endDate: Date; startPart: LeaveSpan["startPart"]; endPart: LeaveSpan["endPart"] }): LeaveSpan => ({
  startDate: iso(r.startDate),
  endDate: iso(r.endDate),
  startPart: r.startPart,
  endPart: r.endPart,
});

// The type and note are private: only the person and super admins see them.
function details(viewer: Actor, r: { userId: string; type: LeaveType; note: string | null }) {
  return viewer.id === r.userId || isSuperAdmin(viewer) ? { type: r.type, note: r.note } : { type: null, note: null };
}

// First and last day of a "YYYY-MM" month.
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { start: `${month}-01`, end: iso(new Date(Date.UTC(y, m, 0))) };
}

const overlapping = (from: string, to: string): Prisma.LeaveRequestWhereInput => ({
  startDate: { lte: asDate(to) },
  endDate: { gte: asDate(from) },
});

export async function getLeaveOverview(viewer: Actor, month: string, today: string) {
  const range = monthRange(month);
  const superAdmin = isSuperAdmin(viewer);
  const approved = { status: "approved" as const, user: { active: true } };

  const [people, calendar, soon, mine, pending, decided] = await Promise.all([
    // Everyone gets a row on the team chart, away or not.
    db.user.findMany({ where: { active: true }, orderBy: [{ name: "asc" }, { email: "asc" }], select: person.select }),
    db.leaveRequest.findMany({
      where: { ...approved, ...overlapping(range.start, range.end) },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, userId: true, type: true, note: true, startDate: true, endDate: true, startPart: true, endPart: true, user: person },
    }),
    db.leaveRequest.findMany({
      where: { ...approved, ...overlapping(today, addDays(today, 30)) },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      take: 50,
      select: { id: true, userId: true, type: true, note: true, startDate: true, endDate: true, startPart: true, endPart: true, user: person },
    }),
    db.leaveRequest.findMany({
      where: { userId: viewer.id },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      take: 50,
      select: { id: true, type: true, note: true, status: true, startDate: true, endDate: true, startPart: true, endPart: true },
    }),
    superAdmin
      ? db.leaveRequest.findMany({
          where: { status: "pending", user: { active: true } },
          orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
          select: { id: true, userId: true, type: true, note: true, startDate: true, endDate: true, startPart: true, endPart: true, createdAt: true, user: person },
        })
      : [],
    // Approvals tab: decisions from the last 30 days, newest first.
    superAdmin
      ? db.leaveEvent.findMany({
          where: { action: { in: ["approved", "auto_approved", "rejected", "revoked"] }, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            action: true,
            actorName: true,
            note: true,
            createdAt: true,
            request: {
              select: { id: true, userId: true, type: true, note: true, status: true, startDate: true, endDate: true, startPart: true, endPart: true, user: person },
            },
          },
        })
      : [],
  ]);

  const shared = (r: (typeof calendar)[number]) => ({ id: r.id, user: r.user, ...span(r), ...details(viewer, r) });

  return {
    range,
    people,
    calendar: calendar.map(shared),
    soon: soon.map(shared),
    mine: mine.map((r) => ({ id: r.id, type: r.type, note: r.note, status: r.status, ...span(r) })),
    pending: pending.map((r) => ({ ...shared(r), requestedAt: r.createdAt.toISOString(), isMine: r.userId === viewer.id })),
    decided: decided.map((e) => ({
      id: e.id,
      action: e.action,
      by: e.actorName,
      reason: e.note,
      at: e.createdAt.toISOString(),
      status: e.request.status,
      request: shared(e.request),
    })),
  };
}

export type LeaveOverview = Awaited<ReturnType<typeof getLeaveOverview>>;
export type LeaveEntry = LeaveOverview["calendar"][number];
export type MyLeave = LeaveOverview["mine"][number];
export type PendingLeave = LeaveOverview["pending"][number];
export type DecidedLeave = LeaveOverview["decided"][number];

// Approved leave around today for the Team page's "On leave" badge. The
// client decides with its own today, so a day either side is included.
export async function getLeaveAroundToday() {
  const today = iso(new Date());
  const rows = await db.leaveRequest.findMany({
    where: { status: "approved", ...overlapping(addDays(today, -1), addDays(today, 1)) },
    select: { userId: true, startDate: true, endDate: true, startPart: true, endPart: true },
  });
  return rows.map((r) => ({ userId: r.userId, ...span(r) }));
}

// Nobody approves their own leave, so the only active super admin adds
// leave directly ("Add leave") instead of requesting it.
export async function isSoleSuperAdmin(viewer: Actor) {
  if (!isSuperAdmin(viewer)) return false;
  return (await db.user.count({ where: { role: "super_admin", active: true, id: { not: viewer.id } } })) === 0;
}

// Super admins' "waiting for you" count in the sidebar (their own requests
// excluded, since they can't approve those).
export function countPendingLeave(viewer: Actor) {
  if (!isSuperAdmin(viewer)) return Promise.resolve(0);
  return db.leaveRequest.count({ where: { status: "pending", userId: { not: viewer.id }, user: { active: true } } });
}

// ─── Calendar feed link ──────────────────────────────────────────────────────

const FEED_KEY = "leaveFeedToken";

export async function getFeedToken() {
  const row = await db.appSetting.upsert({
    where: { key: FEED_KEY },
    create: { key: FEED_KEY, value: randomBytes(24).toString("base64url") },
    update: {},
  });
  return row.value;
}

export async function resetFeedToken() {
  const value = randomBytes(24).toString("base64url");
  await db.appSetting.upsert({ where: { key: FEED_KEY }, create: { key: FEED_KEY, value }, update: { value } });
}

// Approved leave from three months back to a year ahead: who and when only.
export async function getFeedEntries() {
  const today = iso(new Date());
  const rows = await db.leaveRequest.findMany({
    where: { status: "approved", user: { active: true }, ...overlapping(addDays(today, -90), addDays(today, 365)) },
    orderBy: { startDate: "asc" },
    select: { id: true, updatedAt: true, startDate: true, endDate: true, startPart: true, endPart: true, user: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({ id: r.id, updatedAt: r.updatedAt, name: r.user.name ?? r.user.email, ...span(r) }));
}
