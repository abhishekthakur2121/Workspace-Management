import "server-only";
import { db } from "@/server/db";
import { positionAfter, positionBetween } from "@/server/positions";

// Fractional positions at the start/end of a group (table) or status column (Kanban).
export const toDate = (d: string) => new Date(`${d}T00:00:00Z`);

export async function endOfGroup(groupId: string, parentId: string | null) {
  const last = await db.task.findFirst({
    where: { groupId, parentId, deletedAt: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return positionAfter(last?.position);
}

export async function startOfGroup(groupId: string) {
  const first = await db.task.findFirst({
    where: { groupId, parentId: null, deletedAt: null },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  return positionBetween(null, first?.position);
}

export async function endOfStatusColumn(boardId: string, statusId: string | null) {
  const last = await db.task.findFirst({
    where: { boardId, statusId, parentId: null, deletedAt: null },
    orderBy: { kanbanPosition: "desc" },
    select: { kanbanPosition: true },
  });
  return positionAfter(last?.kanbanPosition);
}
