import "server-only";
import { db } from "@/server/db";
import { visibleBoardWhere, type Actor } from "@/server/access";

// Every live task or subtask where the user is accountable or responsible,
// on boards they can still see, soonest due first (no date last).
export async function getMyWork(user: Actor) {
  const userId = user.id;
  const tasks = await db.task.findMany({
    where: {
      deletedAt: null,
      group: { deletedAt: null },
      board: { deletedAt: null, workspace: { deletedAt: null }, ...visibleBoardWhere(user) },
      AND: [
        { OR: [{ parentId: null }, { parent: { deletedAt: null } }] },
        { OR: [{ accountableId: userId }, { responsible: { some: { userId } } }] },
      ],
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 1000,
    select: {
      id: true,
      name: true,
      dueDate: true,
      priority: true,
      statusId: true,
      accountableId: true,
      parent: { select: { name: true } },
      board: {
        select: {
          id: true,
          name: true,
          workspace: { select: { name: true, color: true } },
          statuses: { orderBy: { position: "asc" }, select: { id: true, name: true, color: true, isDone: true, position: true } },
        },
      },
    },
  });

  return tasks.map((t) => ({
    id: t.id,
    name: t.name,
    parentName: t.parent?.name ?? null,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    priority: t.priority,
    statusId: t.statusId,
    role: t.accountableId === userId ? ("accountable" as const) : ("responsible" as const),
    board: { id: t.board.id, name: t.board.name, workspace: t.board.workspace, statuses: t.board.statuses },
  }));
}

export type MyTask = Awaited<ReturnType<typeof getMyWork>>[number];
