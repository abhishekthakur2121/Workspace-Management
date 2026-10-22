"use server";

// Task panel: the "Updates" thread (comments) and the change history.

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth-guard";
import type { Prisma } from "@/generated/prisma/client";

const id = z.string().min(1);
const body = z.string().trim().min(1, "Write something first").max(5000);

const author = { select: { id: true, name: true, email: true, image: true, active: true } } as const;

export async function loadTaskThread(input: { taskId: string }) {
  await requireUser();
  const { taskId } = z.object({ taskId: id }).parse(input);
  const [comments, activity] = await Promise.all([
    db.comment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, body: true, createdAt: true, editedAt: true, author },
    }),
    db.activity.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, action: true, field: true, oldValue: true, newValue: true, createdAt: true, actor: author },
    }),
  ]);
  return {
    comments: comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), editedAt: c.editedAt?.toISOString() ?? null })),
    activity: activity.map((a) => ({
      ...a,
      oldValue: a.oldValue as Prisma.JsonValue,
      newValue: a.newValue as Prisma.JsonValue,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export type TaskThread = Awaited<ReturnType<typeof loadTaskThread>>;
export type ThreadComment = TaskThread["comments"][number];
export type ThreadActivity = TaskThread["activity"][number];

// Bumping the task's updatedAt lets other open boards notice the new count.
const touchTask = (taskId: string) => db.task.update({ where: { id: taskId }, data: { updatedAt: new Date() } });

export async function addComment(input: { taskId: string; body: string }) {
  const user = await requireUser();
  const data = z.object({ taskId: id, body }).parse(input);
  await db.task.findFirstOrThrow({ where: { id: data.taskId, deletedAt: null }, select: { id: true } });
  const [comment] = await db.$transaction([
    db.comment.create({
      data: { taskId: data.taskId, authorId: user.id, body: data.body },
      select: { id: true, body: true, createdAt: true, editedAt: true, author },
    }),
    touchTask(data.taskId),
  ]);
  refresh();
  return { ...comment, createdAt: comment.createdAt.toISOString(), editedAt: null };
}

// Authors edit their own updates; admins may also remove anyone's.
async function ownComment(commentId: string, allowAdmin: boolean) {
  const user = await requireUser();
  const comment = await db.comment.findFirstOrThrow({
    where: { id: commentId, deletedAt: null },
    select: { authorId: true, taskId: true },
  });
  const allowed = comment.authorId === user.id || (allowAdmin && user.role === "admin");
  if (!allowed) throw new Error("Not allowed");
  return comment;
}

export async function editComment(input: { id: string; body: string }) {
  const data = z.object({ id, body }).parse(input);
  const comment = await ownComment(data.id, false);
  await db.$transaction([
    db.comment.update({ where: { id: data.id }, data: { body: data.body, editedAt: new Date() } }),
    touchTask(comment.taskId),
  ]);
  refresh();
}

export async function deleteComment(input: { id: string }) {
  const data = z.object({ id }).parse(input);
  const comment = await ownComment(data.id, true);
  await db.$transaction([db.comment.update({ where: { id: data.id }, data: { deletedAt: new Date() } }), touchTask(comment.taskId)]);
  refresh();
}
