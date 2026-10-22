import { connection } from "next/server";
import { auth } from "@/auth";
import { getBoardVersion } from "@/server/queries/board";

// Cheap "has anything changed?" check that open boards poll; the full board is
// only refetched when the version differs.
export async function GET(_req: Request, ctx: RouteContext<"/api/boards/[boardId]/version">) {
  await connection();
  const session = await auth();
  if (!session?.user?.active) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await ctx.params;
  const version = await getBoardVersion(boardId);
  if (!version) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
