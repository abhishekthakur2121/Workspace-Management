// Daily clean-up (Netlify scheduled function). Soft-deleted items stay
// restorable for 30 days; after that they are removed for good. Foreign keys
// cascade, so deleting a workspace/board/group/task also removes everything
// under it (tasks, subtasks, comments, history). People are never deleted;
// the app only deactivates them.
import { neon } from "@neondatabase/serverless";

const RETENTION_DAYS = 30;

export default async function purgeDeleted() {
  const url = process.env.DATABASE_URL;
  if (!url) return new Response("DATABASE_URL is not set", { status: 500 });
  const sql = neon(url);
  const days = `${RETENTION_DAYS} days`;

  const older = (table: "Workspace" | "Board" | "Group" | "Task" | "Comment") =>
    sql.query(`DELETE FROM "${table}" WHERE "deletedAt" < now() - $1::interval RETURNING id`, [days]);

  // Outermost first, so rows already removed by a cascade aren't counted again.
  const workspaces = await older("Workspace");
  const boards = await older("Board");
  const groups = await older("Group");
  const tasks = await older("Task");
  const comments = await older("Comment");
  const sessions = await sql`DELETE FROM "Session" WHERE expires < now() RETURNING "sessionToken"`;

  const summary = {
    workspaces: workspaces.length,
    boards: boards.length,
    groups: groups.length,
    tasks: tasks.length,
    comments: comments.length,
    expiredSessions: sessions.length,
  };
  console.log("purge-deleted", JSON.stringify(summary));
  return Response.json(summary);
}

export const config = { schedule: "@daily" };
