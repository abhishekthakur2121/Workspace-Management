import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { assertCanSeeTasks, type Actor } from "@/server/access";

// Posting an update on a task as a given person, from the task panel or a
// connected app (`via`, its name, shown next to the update).

export const commentBody = z.string().trim().min(1, "Write something first").max(5000);
export const commentAuthor = { select: { id: true, name: true, email: true, image: true, active: true } } as const;

// Bumping the task's updatedAt lets other open boards notice the new count.
export const touchTask = (taskId: string) => db.task.update({ where: { id: taskId }, data: { updatedAt: new Date() } });

export async function addCommentAs(user: Actor, input: { taskId: string; body: string }, via?: string) {
  const data = z.object({ taskId: z.string().min(1), body: commentBody }).parse(input);
  await assertCanSeeTasks(user, [data.taskId]);
  await db.task.findFirstOrThrow({ where: { id: data.taskId, deletedAt: null }, select: { id: true } });
  const [comment] = await db.$transaction([
    db.comment.create({
      data: { taskId: data.taskId, authorId: user.id, body: data.body, via },
      select: { id: true, body: true, via: true, createdAt: true, editedAt: true, author: commentAuthor },
    }),
    touchTask(data.taskId),
  ]);
  return comment;
}
