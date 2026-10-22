"use server";

// Groups, status labels and tags. Each change bumps Board.updatedAt so other
// people's open boards notice it on their next sync.

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth-guard";
import { positionAfter, positionBetween } from "@/server/positions";
import { PALETTE } from "@/lib/utils";

const id = z.string().min(1);
const label = z.string().trim().min(1).max(60);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);

const touchBoard = (boardId: string) => db.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });

// ─── groups ──────────────────────────────────────────────────────────────────

export async function createGroup(input: { boardId: string; name?: string }) {
  await requireUser();
  const data = z.object({ boardId: id, name: label.optional() }).parse(input);
  const [first, count] = await Promise.all([
    db.group.findFirst({ where: { boardId: data.boardId, deletedAt: null }, orderBy: { position: "asc" }, select: { position: true } }),
    db.group.count({ where: { boardId: data.boardId } }),
  ]);
  // New groups go on top, as in monday.
  const group = await db.group.create({
    data: {
      boardId: data.boardId,
      name: data.name ?? "New group",
      color: PALETTE[count % PALETTE.length],
      position: positionBetween(null, first?.position),
    },
    select: { id: true },
  });
  await touchBoard(data.boardId);
  refresh();
  return group;
}

export async function updateGroup(input: { id: string; name?: string; color?: string }) {
  await requireUser();
  const data = z.object({ id, name: label.optional(), color: color.optional() }).parse(input);
  const group = await db.group.update({ where: { id: data.id }, data: { name: data.name, color: data.color }, select: { boardId: true } });
  await touchBoard(group.boardId);
  refresh();
}

export async function moveGroup(input: { id: string; direction: "up" | "down" }) {
  await requireUser();
  const data = z.object({ id, direction: z.enum(["up", "down"]) }).parse(input);
  const group = await db.group.findUniqueOrThrow({ where: { id: data.id }, select: { boardId: true } });
  const all = await db.group.findMany({
    where: { boardId: group.boardId, deletedAt: null },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  const from = all.findIndex((g) => g.id === data.id);
  const to = data.direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= all.length) return;
  const position =
    data.direction === "up"
      ? positionBetween(all[to - 1]?.position, all[to].position)
      : positionBetween(all[to].position, all[to + 1]?.position);
  await db.group.update({ where: { id: data.id }, data: { position } });
  await touchBoard(group.boardId);
  refresh();
}

export async function deleteGroup(input: { id: string }) {
  await requireUser();
  const data = z.object({ id }).parse(input);
  const group = await db.group.update({ where: { id: data.id }, data: { deletedAt: new Date() }, select: { boardId: true } });
  await touchBoard(group.boardId);
  refresh();
}

export async function restoreGroup(input: { id: string }) {
  await requireUser();
  const data = z.object({ id }).parse(input);
  const group = await db.group.update({ where: { id: data.id }, data: { deletedAt: null }, select: { boardId: true } });
  await touchBoard(group.boardId);
  refresh();
}

// ─── status labels ───────────────────────────────────────────────────────────

export async function createStatus(input: { boardId: string; name: string; color: string }) {
  await requireUser();
  const data = z.object({ boardId: id, name: label, color }).parse(input);
  const last = await db.statusLabel.findFirst({ where: { boardId: data.boardId }, orderBy: { position: "desc" }, select: { position: true } });
  const status = await db.statusLabel.create({
    data: { boardId: data.boardId, name: data.name, color: data.color, position: positionAfter(last?.position) },
    select: { id: true },
  });
  await touchBoard(data.boardId);
  refresh();
  return status;
}

export async function updateStatus(input: { id: string; name?: string; color?: string; isDone?: boolean }) {
  await requireUser();
  const data = z.object({ id, name: label.optional(), color: color.optional(), isDone: z.boolean().optional() }).parse(input);
  const { id: statusId, ...patch } = data;
  const status = await db.statusLabel.update({ where: { id: statusId }, data: patch, select: { boardId: true } });
  await touchBoard(status.boardId);
  refresh();
}

// Tasks with this status become "no status" (onDelete: SetNull).
export async function deleteStatus(input: { id: string }) {
  await requireUser();
  const data = z.object({ id }).parse(input);
  const status = await db.statusLabel.delete({ where: { id: data.id }, select: { boardId: true } });
  await touchBoard(status.boardId);
  refresh();
}

// ─── tags ────────────────────────────────────────────────────────────────────

export async function createTag(input: { boardId: string; name: string }) {
  await requireUser();
  const data = z.object({ boardId: id, name: label }).parse(input);
  const existing = await db.tag.findFirst({
    where: { boardId: data.boardId, name: { equals: data.name, mode: "insensitive" } },
    select: { id: true, name: true, color: true },
  });
  if (existing) return existing;
  const count = await db.tag.count({ where: { boardId: data.boardId } });
  const tag = await db.tag.create({
    data: { boardId: data.boardId, name: data.name, color: PALETTE[(count + 3) % PALETTE.length] },
    select: { id: true, name: true, color: true },
  });
  await touchBoard(data.boardId);
  refresh();
  return tag;
}

export async function deleteTag(input: { id: string }) {
  await requireUser();
  const data = z.object({ id }).parse(input);
  const tag = await db.tag.delete({ where: { id: data.id }, select: { boardId: true } });
  await touchBoard(tag.boardId);
  refresh();
}
