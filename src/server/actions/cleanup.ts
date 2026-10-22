"use server";

// Permanent data clean-up for owners (INITIAL_ADMIN_EMAILS). Foreign keys
// cascade: removing a workspace/board/group/task removes everything under it.
// People are never deleted here.

import { refresh } from "next/cache";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth-guard";
import { isOwner } from "@/server/owners";

type CleanupResult = { ok: true; summary: string } | { error: string };

async function requireOwner() {
  const user = await requireAdmin();
  return isOwner(user.email) ? null : "Only owners (the accounts in INITIAL_ADMIN_EMAILS) can do this.";
}

function describe(counts: Record<string, number>) {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([what, n]) => `${n} ${n === 1 ? what.replace(/s$/, "") : what}`);
  return parts.length ? `Removed ${parts.join(", ")}.` : "Nothing to remove.";
}

// Everything already deleted (normally purged after 30 days), right now.
export async function emptyTrash(): Promise<CleanupResult> {
  const denied = await requireOwner();
  if (denied) return { error: denied };

  const deleted = { deletedAt: { not: null } };
  // Outermost first, so rows removed by a cascade aren't counted again.
  const workspaces = await db.workspace.deleteMany({ where: deleted });
  const boards = await db.board.deleteMany({ where: deleted });
  const groups = await db.group.deleteMany({ where: deleted });
  const tasks = await db.task.deleteMany({ where: deleted });
  const comments = await db.comment.deleteMany({ where: deleted });
  await db.session.deleteMany({ where: { expires: { lt: new Date() } } });

  refresh();
  return {
    ok: true,
    summary: describe({
      workspaces: workspaces.count,
      boards: boards.count,
      groups: groups.count,
      tasks: tasks.count,
      comments: comments.count,
    }),
  };
}

// Every workspace and everything in it, live or deleted. Keeps the team.
export async function resetAllWork(): Promise<CleanupResult> {
  const denied = await requireOwner();
  if (denied) return { error: denied };

  const [boards, tasks, comments] = await Promise.all([db.board.count(), db.task.count(), db.comment.count()]);
  const workspaces = await db.workspace.deleteMany({});

  refresh();
  return { ok: true, summary: describe({ workspaces: workspaces.count, boards, tasks, comments }) };
}
