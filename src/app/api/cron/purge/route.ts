import { connection } from "next/server";
import { db } from "@/server/db";

// Daily clean-up, called by the Vercel Cron Job in vercel.json. Soft-deleted
// items stay restorable for 30 days; after that they are removed for good.
// Foreign keys cascade, so deleting a workspace/board/group/task also removes
// everything under it (tasks, subtasks, comments, history). People are never
// deleted; the app only deactivates them.
const RETENTION_DAYS = 30;

export async function GET(request: Request) {
  await connection(); // always run at request time, never prerender
  // Vercel sends the CRON_SECRET as a bearer token; anyone else is turned away.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const older = { deletedAt: { lt: cutoff } };

  // Outermost first, so rows already removed by a cascade aren't counted again.
  const workspaces = await db.workspace.deleteMany({ where: older });
  const boards = await db.board.deleteMany({ where: older });
  const groups = await db.group.deleteMany({ where: older });
  const tasks = await db.task.deleteMany({ where: older });
  const comments = await db.comment.deleteMany({ where: older });
  const sessions = await db.session.deleteMany({ where: { expires: { lt: new Date() } } });

  // Connected apps: spent codes and tokens, connections revoked (or left with
  // no tokens) over 30 days ago, and apps never approved within a day.
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oauthCodes = await db.oAuthCode.deleteMany({ where: { expiresAt: { lt: now } } });
  const oauthTokens = await db.oAuthToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: dayAgo } }] } });
  const oauthGrants = await db.oAuthGrant.deleteMany({
    where: { OR: [{ revokedAt: { lt: cutoff } }, { createdAt: { lt: cutoff }, tokens: { none: {} } }] },
  });
  const oauthClients = await db.oAuthClient.deleteMany({ where: { createdAt: { lt: dayAgo }, grants: { none: {} } } });

  const summary = {
    workspaces: workspaces.count,
    boards: boards.count,
    groups: groups.count,
    tasks: tasks.count,
    comments: comments.count,
    expiredSessions: sessions.count,
    oauthCodes: oauthCodes.count,
    oauthTokens: oauthTokens.count,
    oauthGrants: oauthGrants.count,
    oauthClients: oauthClients.count,
  };
  console.log("purge-deleted", JSON.stringify(summary));
  return Response.json(summary);
}
