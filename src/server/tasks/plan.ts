import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { activity, type Field } from "./activity";
import { endOfGroup, endOfStatusColumn, toDate } from "./ordering";
import { assertRefs } from "./refs";
import type { TaskPatch } from "./schema";

// Planners do all the reads for a change and return the writes to run, so an
// action can batch several plans into one transaction.
export type Write = Prisma.PrismaPromise<unknown>;

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));


export async function planPatch(taskId: string, patch: TaskPatch, actorId: string): Promise<Write[]> {
  const task = await db.task.findFirstOrThrow({
    where: { id: taskId, deletedAt: null },
    select: {
      boardId: true,
      parentId: true,
      name: true,
      accountableId: true,
      statusId: true,
      dueDate: true,
      priority: true,
      responsible: { select: { userId: true } },
      tags: { select: { tagId: true } },
    },
  });

  const oldDue = task.dueDate?.toISOString().slice(0, 10) ?? null;
  const oldResponsible = task.responsible.map((r) => r.userId);
  const oldTags = task.tags.map((t) => t.tagId);
  const statusChanged = patch.statusId !== undefined && patch.statusId !== task.statusId;

  const [, kanbanPosition] = await Promise.all([
    assertRefs(task.boardId, {
      statusIds: [patch.statusId ?? null],
      tagIds: patch.tagIds,
      userIds: [patch.accountableId ?? null, ...(patch.responsibleIds ?? [])],
    }),
    statusChanged && !task.parentId ? endOfStatusColumn(task.boardId, patch.statusId ?? null) : undefined,
  ]);

  const data: Prisma.TaskUncheckedUpdateInput = { updatedAt: new Date() };
  const changes: { field: Field; from: unknown; to: unknown }[] = [];
  const writes: Write[] = [];

  if (patch.name !== undefined && patch.name !== task.name) {
    data.name = patch.name;
    changes.push({ field: "name", from: task.name, to: patch.name });
  }
  if (patch.accountableId !== undefined && patch.accountableId !== task.accountableId) {
    data.accountableId = patch.accountableId;
    changes.push({ field: "accountableId", from: task.accountableId, to: patch.accountableId });
  }
  if (statusChanged) {
    data.statusId = patch.statusId;
    if (kanbanPosition) data.kanbanPosition = kanbanPosition;
    changes.push({ field: "statusId", from: task.statusId, to: patch.statusId });
  }
  if (patch.dueDate !== undefined && patch.dueDate !== oldDue) {
    data.dueDate = patch.dueDate ? toDate(patch.dueDate) : null;
    changes.push({ field: "dueDate", from: oldDue, to: patch.dueDate });
  }
  if (patch.priority !== undefined && patch.priority !== task.priority) {
    data.priority = patch.priority;
    changes.push({ field: "priority", from: task.priority, to: patch.priority });
  }
  if (patch.responsibleIds !== undefined && !sameSet(patch.responsibleIds, oldResponsible)) {
    writes.push(db.taskResponsible.deleteMany({ where: { taskId } }));
    writes.push(db.taskResponsible.createMany({ data: patch.responsibleIds.map((userId) => ({ taskId, userId })) }));
    changes.push({ field: "responsibleIds", from: oldResponsible, to: patch.responsibleIds });
  }
  if (patch.tagIds !== undefined && !sameSet(patch.tagIds, oldTags)) {
    writes.push(db.taskTag.deleteMany({ where: { taskId } }));
    writes.push(db.taskTag.createMany({ data: patch.tagIds.map((tagId) => ({ taskId, tagId })) }));
    changes.push({ field: "tagIds", from: oldTags, to: patch.tagIds });
  }
  if (!changes.length) return [];

  const log = await Promise.all(changes.map((c) => activity({ taskId, boardId: task.boardId, actorId, action: "updated", ...c })));
  return [db.task.update({ where: { id: taskId }, data }), ...writes, db.activity.createMany({ data: log })];
}

export async function planMove(taskId: string, groupId: string, actorId: string, position?: string): Promise<Write[]> {
  const task = await db.task.findFirstOrThrow({
    where: { id: taskId, deletedAt: null },
    select: { boardId: true, groupId: true, parentId: true },
  });
  if (task.parentId) return []; // subtasks follow their parent
  const changed = task.groupId !== groupId;
  const [, end] = await Promise.all([
    assertRefs(task.boardId, { groupIds: [groupId] }),
    !position && changed ? endOfGroup(groupId, null) : undefined,
  ]);
  const writes: Write[] = [
    db.task.update({ where: { id: taskId }, data: { groupId, position: position ?? end, updatedAt: new Date() } }),
  ];
  if (changed) {
    writes.push(db.task.updateMany({ where: { parentId: taskId }, data: { groupId } }));
    writes.push(
      db.activity.create({
        data: await activity({ taskId, boardId: task.boardId, actorId, action: "moved", field: "group", from: task.groupId, to: groupId }),
      }),
    );
  }
  return writes;
}
