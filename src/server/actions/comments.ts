"use server";

// Task panel: the "Updates" thread (comments) and the change history.

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth-guard";
import { assertCanSeeTasks, isAppAdmin } from "@/server/access";
import { addCommentAs, commentAuthor as author, commentBody as body, touchTask } from "@/server/tasks/comments";
import type { Prisma } from "@/generated/prisma/client";

const id = z.string().min(1);

export async function loadTaskThread(input: { taskId: string }) {
  const user = await requireUser();
  const { taskId } = z.object({ taskId: id }).parse(input);
  await assertCanSeeTasks(user, [taskId]);
  const [comments, activity] = await Promise.all([
    db.comment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, body: true, via: true, createdAt: true, editedAt: true, author },
    }),
    db.activity.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, action: true, field: true, oldValue: true, newValue: true, via: true, createdAt: true, actor: author },
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

export async function addComment(input: { taskId: string; body: string }) {
  const user = await requireUser();
  const comment = await addCommentAs(user, input);
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
  await assertCanSeeTasks(user, [comment.taskId]);
  const allowed = comment.authorId === user.id || (allowAdmin && isAppAdmin(user));
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
