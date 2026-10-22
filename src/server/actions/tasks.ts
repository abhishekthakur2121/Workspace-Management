"use server";

// Task mutations. Each action does its reads first (in parallel), then sends
// all writes — the change plus its activity-log rows — as one batched
// transaction, so a save is a single round trip to the database. The helpers
// live in src/server/tasks/.

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth-guard";
import { positionAfter, positionBetween } from "@/server/positions";
import { assertRefs } from "@/server/tasks/refs";
import { endOfGroup, endOfStatusColumn, startOfGroup } from "@/server/tasks/ordering";
import { planMove, planPatch } from "@/server/tasks/plan";
import { id, name, patchSchema, type TaskPatch } from "@/server/tasks/schema";

export type { TaskPatch };

export async function createTask(input: {
  boardId: string;
  groupId: string;
  name: string;
  parentId?: string | null;
  statusId?: string | null;
  at?: "top" | "bottom";
}) {
  const user = await requireUser();
  const data = z
    .object({
      boardId: id,
      groupId: id,
      name,
      parentId: id.nullish(),
      statusId: id.nullish(),
      at: z.enum(["top", "bottom"]).default("bottom"),
    })
    .parse(input);

  const parent = data.parentId
    ? await db.task.findFirstOrThrow({
        where: { id: data.parentId, boardId: data.boardId, parentId: null, deletedAt: null },
        select: { groupId: true },
      })
    : null;
  const groupId = parent?.groupId ?? data.groupId;
  const parentId = data.parentId ?? null;
  // Defaults, as in monday: the board's first status label, and the creator
  // owns the outcome. An explicit null (the "No status" section) stays empty.
  const statusId =
    data.statusId !== undefined
      ? data.statusId
      : ((await db.statusLabel.findFirst({ where: { boardId: data.boardId }, orderBy: { position: "asc" }, select: { id: true } }))?.id ?? null);

  const [, position, kanbanPosition] = await Promise.all([
    assertRefs(data.boardId, { groupIds: [groupId], statusIds: [statusId] }),
    data.at === "top" && !parentId ? startOfGroup(groupId) : endOfGroup(groupId, parentId),
    endOfStatusColumn(data.boardId, statusId),
  ]);

  const taskId = randomUUID();
  await db.$transaction([
    db.task.create({
      data: {
        id: taskId,
        boardId: data.boardId,
        groupId,
        parentId,
        name: data.name,
        statusId,
        accountableId: user.id,
        position,
        kanbanPosition,
        createdById: user.id,
      },
    }),
    db.activity.create({ data: { taskId, boardId: data.boardId, actorId: user.id, action: "created" } }),
  ]);
  refresh();
  return { id: taskId };
}

export async function updateTask(input: { id: string; patch: TaskPatch }) {
  const user = await requireUser();
  const data = z.object({ id, patch: patchSchema }).parse(input);
  const writes = await planPatch(data.id, data.patch, user.id);
  if (writes.length) await db.$transaction(writes);
  refresh();
}

// Applies the same change to several tasks (bulk actions bar).
export async function bulkUpdateTasks(input: { ids: string[]; patch: TaskPatch; groupId?: string }) {
  const user = await requireUser();
  const data = z.object({ ids: z.array(id).min(1).max(500), patch: patchSchema, groupId: id.optional() }).parse(input);
  const plans = await Promise.all(
    data.ids.map(async (taskId) => [
      ...(await planPatch(taskId, data.patch, user.id)),
      ...(data.groupId ? await planMove(taskId, data.groupId, user.id) : []),
    ]),
  );
  const writes = plans.flat();
  if (writes.length) await db.$transaction(writes);
  refresh();
}

// Drag and drop in the table: place a top-level task between two neighbours,
// possibly in another group.
export async function moveTask(input: { id: string; groupId: string; prevId?: string | null; nextId?: string | null }) {
  const user = await requireUser();
  const data = z.object({ id, groupId: id, prevId: id.nullish(), nextId: id.nullish() }).parse(input);
  const neighbours = await db.task.findMany({
    where: { id: { in: [data.prevId, data.nextId].filter((x): x is string => !!x) }, groupId: data.groupId },
    select: { id: true, position: true },
  });
  const prev = neighbours.find((t) => t.id === data.prevId)?.position;
  const next = neighbours.find((t) => t.id === data.nextId)?.position;
  const writes = await planMove(data.id, data.groupId, user.id, positionBetween(prev, next));
  if (writes.length) await db.$transaction(writes);
  refresh();
}

async function setDeleted(ids: string[], deleted: boolean, actorId: string) {
  const tasks = await db.task.findMany({
    where: { id: { in: ids }, deletedAt: deleted ? null : { not: null } },
    select: { id: true, boardId: true },
  });
  if (!tasks.length) return;
  await db.$transaction([
    db.task.updateMany({ where: { id: { in: tasks.map((t) => t.id) } }, data: { deletedAt: deleted ? new Date() : null } }),
    db.activity.createMany({
      data: tasks.map((t) => ({ taskId: t.id, boardId: t.boardId, actorId, action: deleted ? "deleted" : "restored" })),
    }),
  ]);
}

export async function deleteTasks(input: { ids: string[] }) {
  const user = await requireUser();
  const data = z.object({ ids: z.array(id).min(1).max(500) }).parse(input);
  await setDeleted(data.ids, true, user.id);
  refresh();
}

export async function restoreTasks(input: { ids: string[] }) {
  const user = await requireUser();
  const data = z.object({ ids: z.array(id).min(1).max(500) }).parse(input);
  await setDeleted(data.ids, false, user.id);
  refresh();
}

// Kanban drag and drop: move a card into a status column between two
// neighbours. Changing column changes the status (and is logged).
export async function moveTaskKanban(input: { id: string; statusId: string | null; prevId?: string | null; nextId?: string | null }) {
  const user = await requireUser();
  const data = z.object({ id, statusId: id.nullable(), prevId: id.nullish(), nextId: id.nullish() }).parse(input);
  const [neighbours, statusWrites] = await Promise.all([
    db.task.findMany({
      where: { id: { in: [data.prevId, data.nextId].filter((x): x is string => !!x) } },
      select: { id: true, kanbanPosition: true },
    }),
    planPatch(data.id, { statusId: data.statusId }, user.id),
  ]);
  const prev = neighbours.find((t) => t.id === data.prevId)?.kanbanPosition;
  const next = neighbours.find((t) => t.id === data.nextId)?.kanbanPosition;
  await db.$transaction([
    ...statusWrites,
    db.task.update({
      where: { id: data.id },
      // Neighbours can be stale if someone else reordered meanwhile; fall back to "after prev".
      data: { kanbanPosition: prev && next && prev >= next ? positionAfter(prev) : positionBetween(prev, next), updatedAt: new Date() },
    }),
  ]);
  refresh();
}
