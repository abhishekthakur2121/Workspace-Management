import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { assertCanSeeBoard, assertCanSeeTasks, type Actor } from "@/server/access";
import { assertRefs } from "./refs";
import { endOfGroup, endOfStatusColumn, startOfGroup } from "./ordering";
import { planPatch } from "./plan";
import { id, name, patchSchema, type TaskPatch } from "./schema";

// Creating and editing a task as a given person. The server actions (for the
// signed-in person) and the MCP tools (for a connected app's person) both call
// these, so the rules and the activity log are the same either way. `via` is
// the connected app's name, shown in the history next to the person's name.

export async function createTaskAs(
  user: Actor,
  input: { boardId: string; groupId: string; name: string; parentId?: string | null; statusId?: string | null; at?: "top" | "bottom" },
  via?: string,
) {
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
  await assertCanSeeBoard(user, data.boardId);

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
    db.activity.create({ data: { taskId, boardId: data.boardId, actorId: user.id, action: "created", via } }),
  ]);
  return { id: taskId };
}

export async function updateTaskAs(user: Actor, input: { id: string; patch: TaskPatch }, via?: string) {
  const data = z.object({ id, patch: patchSchema }).parse(input);
  await assertCanSeeTasks(user, [data.id]);
  const writes = await planPatch(data.id, data.patch, user.id, via);
  if (writes.length) await db.$transaction(writes);
}
