import "server-only";
import { db } from "@/server/db";
import type { Priority } from "@/generated/prisma/client";
import { boardAccess, boardAudience, type Actor } from "@/server/access";

// Returns null when the board doesn't exist or this person can't see it.
export async function getBoardData(boardId: string, user: Actor) {
  const access = await boardAccess(user, boardId);
  if (!access.canSee) return null;
  const board = await db.board.findFirst({
    where: { id: boardId, deletedAt: null, workspace: { deletedAt: null } },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      updatedAt: true,
      visibility: true,
      createdById: true,
      members: { select: { userId: true } },
      workspace: { select: { id: true, name: true, color: true } },
      groups: {
        where: { deletedAt: null },
        orderBy: { position: "asc" },
        select: { id: true, name: true, color: true, position: true },
      },
      statuses: {
        orderBy: { position: "asc" },
        select: { id: true, name: true, color: true, position: true, isDone: true },
      },
      tags: { orderBy: { name: "asc" }, select: { id: true, name: true, color: true } },
    },
  });
  if (!board) return null;

  const [tasks, users, audience] = await Promise.all([
    db.task.findMany({
      where: { boardId, deletedAt: null, group: { deletedAt: null }, OR: [{ parentId: null }, { parent: { deletedAt: null } }] },
      orderBy: { position: "asc" },
      select: {
        id: true,
        groupId: true,
        parentId: true,
        name: true,
        accountableId: true,
        statusId: true,
        dueDate: true,
        priority: true,
        position: true,
        kanbanPosition: true,
        updatedAt: true,
        responsible: { select: { userId: true } },
        tags: { select: { tagId: true } },
        _count: { select: { comments: { where: { deletedAt: null } } } },
      },
    }),
    db.user.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, image: true, active: true },
    }),
    boardAudience(boardId),
  ]);

  const rows: TaskRow[] = tasks.map((t) => ({
    id: t.id,
    groupId: t.groupId,
    parentId: t.parentId,
    name: t.name,
    accountableId: t.accountableId,
    responsibleIds: t.responsible.map((r) => r.userId),
    statusId: t.statusId,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    priority: t.priority,
    tagIds: t.tags.map((x) => x.tagId),
    position: t.position,
    kanbanPosition: t.kanbanPosition,
    commentCount: t._count.comments,
  }));

  const { updatedAt, members, ...rest } = board;
  return {
    ...rest,
    sharedWith: members.map((m) => m.userId),
    canManage: access.canManage,
    // People who can see this board: the only ones pickers offer for assignment.
    audience,
    tasks: rows,
    users,
    version: boardVersion(updatedAt, tasks),
  };
}

// Changes whenever anything on the board changes: label/group/tag edits bump
// Board.updatedAt, and every task write (including soft deletes) bumps the task.
function boardVersion(boardUpdatedAt: Date, tasks: { updatedAt: Date }[]) {
  const latest = Math.max(boardUpdatedAt.getTime(), ...tasks.map((t) => t.updatedAt.getTime()));
  return `${latest}:${tasks.length}`;
}

export async function getBoardVersion(boardId: string) {
  const [board, agg] = await Promise.all([
    db.board.findUnique({ where: { id: boardId }, select: { updatedAt: true } }),
    db.task.aggregate({
      where: { boardId, deletedAt: null, group: { deletedAt: null }, OR: [{ parentId: null }, { parent: { deletedAt: null } }] },
      _max: { updatedAt: true },
      _count: true,
    }),
  ]);
  if (!board) return null;
  const latest = Math.max(board.updatedAt.getTime(), agg._max.updatedAt?.getTime() ?? 0);
  return `${latest}:${agg._count}`;
}

export type TaskRow = {
  id: string;
  groupId: string;
  parentId: string | null;
  name: string;
  accountableId: string | null;
  responsibleIds: string[];
  statusId: string | null;
  dueDate: string | null; // YYYY-MM-DD
  priority: Priority | null;
  tagIds: string[];
  position: string;
  kanbanPosition: string;
  commentCount: number;
};

export type BoardData = NonNullable<Awaited<ReturnType<typeof getBoardData>>>;

export async function recordBoardVisit(userId: string, boardId: string) {
  await db.boardVisit.upsert({
    where: { userId_boardId: { userId, boardId } },
    create: { userId, boardId },
    update: { visitedAt: new Date() },
  });
}
