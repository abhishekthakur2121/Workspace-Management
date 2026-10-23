"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth-guard";
import { positionAfter, positionBetween } from "@/server/positions";
import { AccessError, assertWorkspaceAdmin, canCreateWorkspace } from "@/server/access";
import { PALETTE } from "@/lib/utils";

const id = z.string().min(1);
const name = z.string().trim().min(1, "Name is required").max(80);

type Result = { ok: true } | { error: string };

// The creator becomes the workspace's admin; memberIds join as members.
export async function createWorkspace(input: { name: string; memberIds?: string[] }) {
  const user = await requireUser();
  if (!(await canCreateWorkspace(user))) throw new AccessError("You don't have permission to create workspaces.");
  const data = z.object({ name, memberIds: z.array(id).max(200).default([]) }).parse(input);

  const [last, count, people] = await Promise.all([
    db.workspace.findFirst({ orderBy: { position: "desc" }, select: { position: true } }),
    db.workspace.count(),
    db.user.findMany({ where: { id: { in: data.memberIds }, active: true }, select: { id: true } }),
  ]);
  const workspace = await db.workspace.create({
    data: {
      name: data.name,
      color: PALETTE[count % PALETTE.length],
      position: positionAfter(last?.position),
      createdById: user.id,
      members: {
        create: [
          { userId: user.id, role: "admin" },
          ...people.filter((p) => p.id !== user.id).map((p) => ({ userId: p.id, role: "member" as const })),
        ],
      },
    },
    select: { id: true },
  });
  refresh();
  return workspace;
}

export async function renameWorkspace(input: { id: string; name: string }) {
  const user = await requireUser();
  const data = z.object({ id, name }).parse(input);
  await assertWorkspaceAdmin(user, data.id);
  await db.workspace.update({ where: { id: data.id }, data: { name: data.name } });
  refresh();
}

export async function setWorkspaceColor(input: { id: string; color: string }) {
  const user = await requireUser();
  const data = z.object({ id, color: z.string().regex(/^#[0-9a-f]{6}$/i) }).parse(input);
  await assertWorkspaceAdmin(user, data.id);
  await db.workspace.update({ where: { id: data.id }, data: { color: data.color } });
  refresh();
}

export async function moveWorkspace(input: { id: string; direction: "up" | "down" }) {
  const user = await requireUser();
  const data = z.object({ id, direction: z.enum(["up", "down"]) }).parse(input);
  await assertWorkspaceAdmin(user, data.id);

  const all = await db.workspace.findMany({
    where: { deletedAt: null },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  const from = all.findIndex((w) => w.id === data.id);
  const to = data.direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= all.length) return;

  // Place it on the far side of the neighbour it swaps with.
  const position =
    data.direction === "up"
      ? positionBetween(all[to - 1]?.position, all[to].position)
      : positionBetween(all[to].position, all[to + 1]?.position);
  await db.workspace.update({ where: { id: data.id }, data: { position } });
  refresh();
}

export async function deleteWorkspace(input: { id: string }) {
  const user = await requireUser();
  const data = z.object({ id }).parse(input);
  await assertWorkspaceAdmin(user, data.id);
  await db.workspace.update({ where: { id: data.id }, data: { deletedAt: new Date() } });
  refresh();
}

export async function restoreWorkspace(input: { id: string }) {
  const user = await requireUser();
  const data = z.object({ id }).parse(input);
  await assertWorkspaceAdmin(user, data.id);
  await db.workspace.update({ where: { id: data.id }, data: { deletedAt: null } });
  refresh();
}

// ─── members ─────────────────────────────────────────────────────────────────

// Active people, for choosing members when creating a workspace.
export async function listPeopleForNewWorkspace() {
  const user = await requireUser();
  if (!(await canCreateWorkspace(user))) throw new AccessError();
  return db.user.findMany({
    where: { active: true, id: { not: user.id } },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true, image: true },
  });
}

export async function getWorkspaceMembers(input: { workspaceId: string }) {
  const user = await requireUser();
  const { workspaceId } = z.object({ workspaceId: id }).parse(input);
  await assertWorkspaceAdmin(user, workspaceId);
  const [members, people] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { userId: true, role: true, canCreateBoards: true, user: { select: { name: true, email: true, image: true, active: true } } },
    }),
    db.user.findMany({ where: { active: true }, orderBy: [{ name: "asc" }, { email: "asc" }], select: { id: true, name: true, email: true, image: true } }),
  ]);
  return { members, people };
}

const otherWorkspaceAdmins = (workspaceId: string, exceptUserId: string) =>
  db.workspaceMember.count({ where: { workspaceId, role: "admin", userId: { not: exceptUserId } } });

export async function addWorkspaceMembers(input: { workspaceId: string; userIds: string[] }): Promise<Result> {
  const user = await requireUser();
  const data = z.object({ workspaceId: id, userIds: z.array(id).min(1).max(200) }).parse(input);
  await assertWorkspaceAdmin(user, data.workspaceId);
  const people = await db.user.findMany({ where: { id: { in: data.userIds }, active: true }, select: { id: true } });
  await db.workspaceMember.createMany({
    data: people.map((p) => ({ workspaceId: data.workspaceId, userId: p.id, role: "member" as const })),
    skipDuplicates: true,
  });
  refresh();
  return { ok: true };
}

export async function updateWorkspaceMember(input: {
  workspaceId: string;
  userId: string;
  role?: "admin" | "member";
  canCreateBoards?: boolean;
}): Promise<Result> {
  const user = await requireUser();
  const data = z
    .object({ workspaceId: id, userId: id, role: z.enum(["admin", "member"]).optional(), canCreateBoards: z.boolean().optional() })
    .parse(input);
  await assertWorkspaceAdmin(user, data.workspaceId);
  if (data.role === "member" && (await otherWorkspaceAdmins(data.workspaceId, data.userId)) === 0) {
    return { error: "A workspace needs at least one admin. Make someone else an admin first." };
  }
  await db.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: data.workspaceId, userId: data.userId } },
    data: { role: data.role, canCreateBoards: data.canCreateBoards },
  });
  refresh();
  return { ok: true };
}

// Removing someone hides the workspace from them at once. Their existing
// task assignments stay, but they can no longer see those boards.
export async function removeWorkspaceMember(input: { workspaceId: string; userId: string }): Promise<Result> {
  const user = await requireUser();
  const data = z.object({ workspaceId: id, userId: id }).parse(input);
  await assertWorkspaceAdmin(user, data.workspaceId);
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: data },
    select: { role: true },
  });
  if (!member) return { ok: true };
  if (member.role === "admin" && (await otherWorkspaceAdmins(data.workspaceId, data.userId)) === 0) {
    return { error: "A workspace needs at least one admin." };
  }
  await db.$transaction([
    db.workspaceMember.delete({ where: { workspaceId_userId: data } }),
    // Also drop them from private boards in this workspace.
    db.boardMember.deleteMany({ where: { userId: data.userId, board: { workspaceId: data.workspaceId } } }),
  ]);
  refresh();
  return { ok: true };
}
