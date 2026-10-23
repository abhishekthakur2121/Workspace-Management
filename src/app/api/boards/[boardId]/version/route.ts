import { connection } from "next/server";
import { auth } from "@/auth";
import { getBoardVersion } from "@/server/queries/board";
import { boardAccess } from "@/server/access";

// Cheap "has anything changed?" check that open boards poll; the full board is
// only refetched when the version differs.
export async function GET(_req: Request, ctx: RouteContext<"/api/boards/[boardId]/version">) {
  await connection();
  const session = await auth();
  if (!session?.user?.active) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await ctx.params;
  // Losing access to a board also stops its sync (looks like "not found").
  if (!(await boardAccess(session.user, boardId)).canSee) return Response.json({ error: "Not found" }, { status: 404 });
  const version = await getBoardVersion(boardId);
  if (!version) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
