import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

// Who can see and change what. Every query and server action goes through
// these helpers; hiding buttons in the UI is only cosmetic.
//
//   App: super_admin   everything, everywhere
//        admin         creates workspaces, manages Users; sees only the
//                      workspaces they're a member of
//        user          works inside workspaces they're added to
//   Workspace: admin   everything inside it, including every board
//              editor  creates boards; manages the boards they created
//              member  edits tasks on boards they can see
//   Boards are visible to the whole workspace or to selected people
//   (workspace admins and the creator always see them).

export type Actor = { id: string; role: "super_admin" | "admin" | "user" };

export class AccessError extends Error {
  constructor(message = "You don't have access to that.") {
    super(message);
  }
}

export const isSuperAdmin = (u: Actor) => u.role === "super_admin";
// App admins (and super admins) may create workspaces and manage people.
export const isAppAdmin = (u: Actor) => u.role === "super_admin" || u.role === "admin";

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
  return isAppAdmin(u);
}

export async function canCreateBoard(u: Actor, workspaceId: string) {
  if (isSuperAdmin(u)) return true;
  const m = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: u.id } },
    select: { role: true },
  });
  return m?.role === "admin" || m?.role === "editor";
}

export async function boardAccess(u: Actor, boardId: string) {
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { workspaceId: true, visibility: true, createdById: true, members: { where: { userId: u.id }, select: { userId: true } } },
  });
  if (!board) return { canSee: false, canManage: false, workspaceId: null };
  const role = await workspaceRole(u, board.workspaceId);
  // Workspace admins manage every board; editors manage the boards they created.
  const canManage = role === "admin" || (role === "editor" && board.createdById === u.id);
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
