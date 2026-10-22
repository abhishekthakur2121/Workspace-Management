"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth-guard";
import { positionAfter, positionBetween, positionsFromStart } from "@/server/positions";

const id = z.string().min(1);
const name = z.string().trim().min(1, "Name is required").max(80);

// Every new board starts with monday's default labels and two groups.
const DEFAULT_STATUSES = [
  { name: "Not started", color: "#c4c4c4", isDone: false },
  { name: "Working on it", color: "#fdab3d", isDone: false },
  { name: "Stuck", color: "#e2445c", isDone: false },
  { name: "Done", color: "#00c875", isDone: true },
];
const DEFAULT_GROUPS = [
  { name: "This week", color: "#579bfc" },
  { name: "Backlog", color: "#a25ddc" },
];

export async function createBoard(input: { workspaceId: string; name: string }) {
  await requireUser();
  const data = z.object({ workspaceId: id, name }).parse(input);

  const last = await db.board.findFirst({
    where: { workspaceId: data.workspaceId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const statusKeys = positionsFromStart(DEFAULT_STATUSES.length);
  const groupKeys = positionsFromStart(DEFAULT_GROUPS.length);

  const board = await db.board.create({
    data: {
      workspaceId: data.workspaceId,
      name: data.name,
      position: positionAfter(last?.position),
      statuses: { create: DEFAULT_STATUSES.map((s, i) => ({ ...s, position: statusKeys[i] })) },
      groups: { create: DEFAULT_GROUPS.map((g, i) => ({ ...g, position: groupKeys[i] })) },
    },
    select: { id: true },
  });
  refresh();
  return board;
}

export async function renameBoard(input: { id: string; name: string }) {
  await requireUser();
  const data = z.object({ id, name }).parse(input);
  await db.board.update({ where: { id: data.id }, data: { name: data.name } });
  refresh();
}

// Moves a board between two neighbours (either may be absent at the ends).
export async function reorderBoard(input: { id: string; prevId?: string | null; nextId?: string | null }) {
  await requireUser();
  const data = z.object({ id, prevId: id.nullish(), nextId: id.nullish() }).parse(input);

  const neighbours = await db.board.findMany({
    where: { id: { in: [data.prevId, data.nextId].filter((x): x is string => !!x) } },
    select: { id: true, position: true },
  });
  const prev = neighbours.find((b) => b.id === data.prevId)?.position;
  const next = neighbours.find((b) => b.id === data.nextId)?.position;
  await db.board.update({ where: { id: data.id }, data: { position: positionBetween(prev, next) } });
  refresh();
}

export async function deleteBoard(input: { id: string }) {
  await requireUser();
  const data = z.object({ id }).parse(input);
  await db.board.update({ where: { id: data.id }, data: { deletedAt: new Date() } });
  refresh();
}

export async function restoreBoard(input: { id: string }) {
  await requireUser();
  const data = z.object({ id }).parse(input);
  await db.board.update({ where: { id: data.id }, data: { deletedAt: null } });
  refresh();
}

export async function toggleFavorite(input: { boardId: string }) {
  const user = await requireUser();
  const data = z.object({ boardId: id }).parse(input);
  const key = { userId_boardId: { userId: user.id, boardId: data.boardId } };

  const existing = await db.favorite.findUnique({ where: key });
  if (existing) await db.favorite.delete({ where: key });
  else await db.favorite.create({ data: { userId: user.id, boardId: data.boardId } });
  refresh();
  return { favorite: !existing };
}
