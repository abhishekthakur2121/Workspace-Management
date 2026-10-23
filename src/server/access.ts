import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

// Who can see and change what. Every query and server action goes through
// these helpers; hiding buttons in the UI is only cosmetic.
//
//   Super admin (User.role = admin)   everything, everywhere
//   Workspace admin                   everything inside that workspace,
//                                     including every board in it
//   Board creator                     manages their board (name, access)
//   Workspace member                  sees boards shared with the whole
//                                     workspace or with them, and edits
//                                     tasks on any board they can see

export type Actor = { id: string; role: "admin" | "member"; canCreateWorkspaces?: boolean };

export class AccessError extends Error {
  constructor(message = "You don't have access to that.") {
    super(message);
  }
}

export const isSuperAdmin = (u: Actor) => u.role === "admin";

// ─── list filters (Prisma where clauses) ─────────────────────────────────────

export function visibleWorkspaceWhere(u: Actor): Prisma.WorkspaceWhereInput {
  return isSuperAdmin(u) ? {} : { members: { some: { userId: u.id } } };
}

export function visibleBoardWhere(u: Actor): Prisma.BoardWhereInput {
  if (isSuperAdmin(u)) return {};
  return {
    workspace: { members: { some: { userId: u.id } } },
    OR: [
      { visibility: "workspace" },
      { createdById: u.id },
      { members: { some: { userId: u.id } } },
      { workspace: { members: { some: { userId: u.id, role: "admin" } } } },
    ],
  };
}

// ─── single checks ───────────────────────────────────────────────────────────

export async function workspaceRole(u: Actor, workspaceId: string) {
  if (isSuperAdmin(u)) return "admin" as const;
  const m = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: u.id } },
    select: { role: true },
  });
  return m?.role ?? null;
}

export async function assertWorkspaceAdmin(u: Actor, workspaceId: string) {
  if ((await workspaceRole(u, workspaceId)) !== "admin") throw new AccessError("Only workspace admins can do that.");
}

export async function canCreateWorkspace(u: Actor) {
  if (isSuperAdmin(u)) return true;
  const row = await db.user.findUnique({ where: { id: u.id }, select: { canCreateWorkspaces: true } });
  return !!row?.canCreateWorkspaces;
}

export async function canCreateBoard(u: Actor, workspaceId: string) {
  if (isSuperAdmin(u)) return true;
  const m = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: u.id } },
    select: { role: true, canCreateBoards: true },
  });
  return !!m && (m.role === "admin" || m.canCreateBoards);
}

export async function boardAccess(u: Actor, boardId: string) {
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { workspaceId: true, visibility: true, createdById: true, members: { where: { userId: u.id }, select: { userId: true } } },
  });
  if (!board) return { canSee: false, canManage: false, workspaceId: null };
  const role = await workspaceRole(u, board.workspaceId);
  const canManage = role === "admin" || (role !== null && board.createdById === u.id);
  const canSee = canManage || (role !== null && (board.visibility === "workspace" || board.members.length > 0));
  return { canSee, canManage, workspaceId: board.workspaceId };
}

export async function assertCanSeeBoard(u: Actor, boardId: string) {
  if (!(await boardAccess(u, boardId)).canSee) throw new AccessError();
}

export async function assertCanManageBoard(u: Actor, boardId: string) {
  if (!(await boardAccess(u, boardId)).canManage) throw new AccessError("Only the board's creator or a workspace admin can do that.");
}

// For actions that receive task, group, status, tag or comment ids: the
// boards they belong to must all be visible to the actor.
export async function assertCanSeeBoards(u: Actor, boardIds: Iterable<string>) {
  for (const id of new Set(boardIds)) await assertCanSeeBoard(u, id);
}

export async function assertCanSeeTasks(u: Actor, taskIds: string[]) {
  const tasks = await db.task.findMany({ where: { id: { in: taskIds } }, select: { boardId: true } });
  await assertCanSeeBoards(u, tasks.map((t) => t.boardId));
}

// Active people who can see a board: who appears in its people pickers and
// who may be assigned its tasks.
export async function boardAudience(boardId: string) {
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { workspaceId: true, visibility: true, createdById: true, members: { select: { userId: true } } },
  });
  if (!board) return [];
  const members = await db.workspaceMember.findMany({
    where: { workspaceId: board.workspaceId, user: { active: true } },
    select: { userId: true, role: true },
  });
  if (board.visibility === "workspace") return members.map((m) => m.userId);
  const shared = new Set(board.members.map((m) => m.userId));
  return members.filter((m) => m.role === "admin" || m.userId === board.createdById || shared.has(m.userId)).map((m) => m.userId);
}
