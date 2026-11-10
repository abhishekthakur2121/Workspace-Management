"use server";

// Leave requests. Actions return { error } instead of throwing, because
// thrown messages are hidden from the browser in production.
//
//   Anyone requests leave and may cancel it while pending, or once approved
//   if it hasn't started. Only super admins approve, reject or revoke, and
//   never their own request; the only active super admin adds leave
//   directly instead (approved at once, recorded as auto_approved).
//   Every step is written to LeaveEvent (the audit trail).

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireSuperAdmin, requireUser } from "@/server/auth-guard";
import { isSuperAdmin } from "@/server/access";
import { isSoleSuperAdmin, resetFeedToken } from "@/server/queries/leave";
import { addDays, partsAreValid, spansOverlap, workingDays, type LeaveSpan } from "@/lib/leave";
import type { LeaveAction, LeaveStatus } from "@/generated/prisma/client";

type Result = { ok: true } | { error: string };
// requestLeave says whether the leave was approved at once (added directly).
type RequestResult = { ok: true; approved: boolean } | { error: string };

const id = z.string().min(1);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the dates");
const part = z.enum(["full", "morning", "afternoon"]);
const reason = z.string().trim().max(500, "Keep it under 500 characters");

const asDate = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayUTC = () => iso(new Date());
const actorName = (u: { name?: string | null; email?: string | null }) => u.name ?? u.email ?? "Someone";

type Actor = { id: string; name?: string | null; email?: string | null };

// Moves a request on and records who did it, in one transaction. Only a
// request still in `from` changes, so two people can't both act on it.
function transition(id: string, from: LeaveStatus, to: LeaveStatus, action: LeaveAction, actor: Actor, note?: string) {
  return db.$transaction(async (tx) => {
    const changed = await tx.leaveRequest.updateMany({ where: { id, status: from }, data: { status: to } });
    if (changed.count === 0) return false;
    await tx.leaveEvent.create({ data: { requestId: id, action, actorId: actor.id, actorName: actorName(actor), note: note || null } });
    return true;
  });
}

export async function requestLeave(input: {
  type: string;
  startDate: string;
  endDate: string;
  startPart: string;
  endPart: string;
  note?: string;
}): Promise<RequestResult> {
  const user = await requireUser();
  const parsed = z
    .object({ type: z.enum(["holiday", "sick", "personal", "other"]), startDate: day, endDate: day, startPart: part, endPart: part, note: reason.optional() })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
  const data = parsed.data;
  const span: LeaveSpan = data;

  if (data.endDate < data.startDate) return { error: "The last day is before the first day." };
  if (data.endDate > addDays(data.startDate, 365)) return { error: "Leave can't be longer than a year." };
  if (!partsAreValid(span)) return { error: "Choose which part of the day you're away." };
  if (workingDays(span) === 0) return { error: "Those dates are only weekend days." };

  const existing = await db.leaveRequest.findMany({
    where: { userId: user.id, status: { in: ["pending", "approved"] }, startDate: { lte: asDate(data.endDate) }, endDate: { gte: asDate(data.startDate) } },
    select: { startDate: true, endDate: true, startPart: true, endPart: true },
  });
  if (existing.some((r) => spansOverlap(span, { startDate: iso(r.startDate), endDate: iso(r.endDate), startPart: r.startPart, endPart: r.endPart }))) {
    return { error: "You already have leave requested for some of those days." };
  }

  // Nobody approves their own leave; a lone super admin's would wait forever.
  const autoApprove = await isSoleSuperAdmin(user);

  await db.$transaction(async (tx) => {
    const request = await tx.leaveRequest.create({
      data: {
        userId: user.id,
        type: data.type,
        startDate: asDate(data.startDate),
        endDate: asDate(data.endDate),
        startPart: data.startPart,
        endPart: data.endPart,
        note: data.note || null,
        status: autoApprove ? "approved" : "pending",
      },
      select: { id: true },
    });
    await tx.leaveEvent.create({
      data: { requestId: request.id, action: autoApprove ? "auto_approved" : "requested", actorId: user.id, actorName: actorName(user) },
    });
  });
  refresh();
  return { ok: true, approved: autoApprove };
}

// Approve or reject a pending request (super admins, not their own).
export async function decideLeave(input: { id: string; approve: boolean; note?: string }): Promise<Result> {
  const actor = await requireSuperAdmin();
  const parsed = z.object({ id, approve: z.boolean(), note: reason.optional() }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const request = await db.leaveRequest.findUnique({ where: { id: data.id }, select: { userId: true } });
  if (!request) return { error: "That request no longer exists." };
  if (request.userId === actor.id) return { error: "You can't decide on your own leave. Another super admin must." };

  const status = data.approve ? "approved" : "rejected";
  if (!(await transition(data.id, "pending", status, status, actor, data.note))) {
    return { error: "Someone already decided on this request." };
  }
  refresh();
  return { ok: true };
}

// The person withdraws their request: any time while pending, or before an
// approved leave starts.
export async function cancelLeave(input: { id: string }): Promise<Result> {
  const user = await requireUser();
  const data = z.object({ id }).parse(input);
  const request = await db.leaveRequest.findUnique({ where: { id: data.id }, select: { userId: true, status: true, startDate: true } });
  if (!request || request.userId !== user.id) return { error: "That request no longer exists." };
  if (request.status !== "pending" && request.status !== "approved") return { error: "This request can't be cancelled any more." };
  if (request.status === "approved" && iso(request.startDate) <= todayUTC()) {
    return { error: "This leave has already started. Ask a super admin to revoke it." };
  }
  if (!(await transition(data.id, request.status, "cancelled", "cancelled", user))) {
    return { error: "This request can't be cancelled any more." };
  }
  refresh();
  return { ok: true };
}

// A super admin withdraws approved leave; the reason is required.
export async function revokeLeave(input: { id: string; note: string }): Promise<Result> {
  const actor = await requireSuperAdmin();
  const parsed = z.object({ id, note: reason.min(1, "Give a reason for revoking") }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  if (!(await transition(data.id, "approved", "revoked", "revoked", actor, data.note))) {
    return { error: "Only approved leave can be revoked." };
  }
  refresh();
  return { ok: true };
}

// The detail dialog: what the viewer may see of one request, its history,
// and which actions they may take.
export async function loadLeaveDetail(input: { id: string }) {
  const viewer = await requireUser();
  const data = z.object({ id }).parse(input);
  const r = await db.leaveRequest.findUnique({
    where: { id: data.id },
    select: {
      id: true,
      userId: true,
      type: true,
      note: true,
      status: true,
      startDate: true,
      endDate: true,
      startPart: true,
      endPart: true,
      user: { select: { id: true, name: true, email: true, image: true, active: true } },
      events: { orderBy: { createdAt: "asc" }, select: { id: true, action: true, actorName: true, note: true, createdAt: true } },
    },
  });
  const own = r?.userId === viewer.id;
  const superAdmin = isSuperAdmin(viewer);
  // Others may see approved leave (who and when) and nothing else.
  if (!r || (!own && !superAdmin && (r.status !== "approved" || !r.user.active))) return null;
  const full = own || superAdmin;

  return {
    id: r.id,
    user: { id: r.user.id, name: r.user.name, email: r.user.email, image: r.user.image },
    status: r.status,
    startDate: iso(r.startDate),
    endDate: iso(r.endDate),
    startPart: r.startPart,
    endPart: r.endPart,
    type: full ? r.type : null,
    note: full ? r.note : null,
    history: full ? r.events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })) : [],
    can: {
      cancel: own && (r.status === "pending" || (r.status === "approved" && iso(r.startDate) > todayUTC())),
      decide: superAdmin && !own && r.status === "pending",
      revoke: superAdmin && r.status === "approved",
    },
  };
}

export type LeaveDetail = NonNullable<Awaited<ReturnType<typeof loadLeaveDetail>>>;

// Anyone who had the old calendar link loses access.
export async function resetCalendarLink(): Promise<Result> {
  await requireSuperAdmin();
  await resetFeedToken();
  refresh();
  return { ok: true };
}
