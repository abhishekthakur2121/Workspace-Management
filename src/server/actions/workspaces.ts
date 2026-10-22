"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth-guard";
import { positionAfter, positionBetween } from "@/server/positions";
import { PALETTE } from "@/lib/utils";

const id = z.string().min(1);
const name = z.string().trim().min(1, "Name is required").max(80);

export async function createWorkspace(input: { name: string }) {
  await requireUser();
  const data = z.object({ name }).parse(input);

  const [last, count] = await Promise.all([
    db.workspace.findFirst({ orderBy: { position: "desc" }, select: { position: true } }),
    db.workspace.count(),
  ]);
  const workspace = await db.workspace.create({
    data: { name: data.name, color: PALETTE[count % PALETTE.length], position: positionAfter(last?.position) },
    select: { id: true },
  });
  refresh();
  return workspace;
}

export async function renameWorkspace(input: { id: string; name: string }) {
  await requireUser();
  const data = z.object({ id, name }).parse(input);
  await db.workspace.update({ where: { id: data.id }, data: { name: data.name } });
  refresh();
}

export async function setWorkspaceColor(input: { id: string; color: string }) {
  await requireUser();
  const data = z.object({ id, color: z.string().regex(/^#[0-9a-f]{6}$/i) }).parse(input);
  await db.workspace.update({ where: { id: data.id }, data: { color: data.color } });
  refresh();
}

export async function moveWorkspace(input: { id: string; direction: "up" | "down" }) {
  await requireUser();
  const data = z.object({ id, direction: z.enum(["up", "down"]) }).parse(input);

  const all = await db.workspace.findMany({
    where: { deletedAt: null },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  const from = all.findIndex((w) => w.id === data.id);
  const to = data.direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= all.length) return;

  // Place it on the far side of the neighbour it swaps with.
  const position =
    data.direction === "up"
      ? positionBetween(all[to - 1]?.position, all[to].position)
      : positionBetween(all[to].position, all[to + 1]?.position);
  await db.workspace.update({ where: { id: data.id }, data: { position } });
  refresh();
}

export async function deleteWorkspace(input: { id: string }) {
  await requireUser();
  const data = z.object({ id }).parse(input);
  await db.workspace.update({ where: { id: data.id }, data: { deletedAt: new Date() } });
  refresh();
}

export async function restoreWorkspace(input: { id: string }) {
  await requireUser();
  const data = z.object({ id }).parse(input);
  await db.workspace.update({ where: { id: data.id }, data: { deletedAt: null } });
  refresh();
}
