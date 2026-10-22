import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import type { TaskPatch } from "./schema";

export type Field = keyof TaskPatch | "group";

// Readable snapshots, so the history still reads right after a label or person
// is renamed or removed.
async function snapshot(field: Field, value: unknown): Promise<Prisma.InputJsonValue | undefined> {
  if (value === null || value === undefined) return undefined;
  switch (field) {
    case "statusId": {
      const s = await db.statusLabel.findUnique({ where: { id: value as string }, select: { name: true, color: true } });
      return s ? { name: s.name, color: s.color } : undefined;
    }
    case "group": {
      const g = await db.group.findUnique({ where: { id: value as string }, select: { name: true, color: true } });
      return g ? { name: g.name, color: g.color } : undefined;
    }
    case "accountableId": {
      const u = await db.user.findUnique({ where: { id: value as string }, select: { name: true, email: true } });
      return u ? { name: u.name ?? u.email } : undefined;
    }
    case "responsibleIds": {
      const us = await db.user.findMany({ where: { id: { in: value as string[] } }, select: { name: true, email: true } });
      return us.map((u) => u.name ?? u.email);
    }
    case "tagIds": {
      const ts = await db.tag.findMany({ where: { id: { in: value as string[] } }, select: { name: true } });
      return ts.map((t) => t.name);
    }
    default:
      return value as Prisma.InputJsonValue;
  }
}

const FIELD_NAMES: Partial<Record<Field, string>> = {
  statusId: "status",
  accountableId: "accountable",
  responsibleIds: "responsible",
  tagIds: "tags",
};

export async function activity(entry: {
  taskId: string;
  boardId: string;
  actorId: string;
  action: string;
  field?: Field;
  from?: unknown;
  to?: unknown;
}): Promise<Prisma.ActivityCreateManyInput> {
  const [oldValue, newValue] = entry.field
    ? await Promise.all([snapshot(entry.field, entry.from), snapshot(entry.field, entry.to)])
    : [undefined, undefined];
  return {
    taskId: entry.taskId,
    boardId: entry.boardId,
    actorId: entry.actorId,
    action: entry.action,
    field: entry.field ? (FIELD_NAMES[entry.field] ?? entry.field) : null,
    oldValue,
    newValue,
  };
}
