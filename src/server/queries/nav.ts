import "server-only";
import { cache } from "react";
import { db } from "@/server/db";

// Everything the sidebar needs, in one round trip. At ~20 users the whole
// workspace/board tree is small, so it is loaded once per page request
// (cache() dedupes the layout's and the page's calls).
export const getNavData = cache(async (userId: string) => {
  const [workspaces, favorites] = await Promise.all([
    db.workspace.findMany({
      where: { deletedAt: null },
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        boards: {
          where: { deletedAt: null },
          orderBy: { position: "asc" },
          select: { id: true, name: true, workspaceId: true },
        },
      },
    }),
    db.favorite.findMany({
      where: { userId, board: { deletedAt: null, workspace: { deletedAt: null } } },
      orderBy: { createdAt: "asc" },
      select: { boardId: true },
    }),
  ]);

  return { workspaces, favoriteBoardIds: favorites.map((f) => f.boardId) };
});

export type NavData = Awaited<ReturnType<typeof getNavData>>;
export type NavWorkspace = NavData["workspaces"][number];
export type NavBoard = NavWorkspace["boards"][number];

export async function getRecentBoards(userId: string, take = 8) {
  const visits = await db.boardVisit.findMany({
    where: { userId, board: { deletedAt: null, workspace: { deletedAt: null } } },
    orderBy: { visitedAt: "desc" },
    take,
    select: {
      visitedAt: true,
      board: { select: { id: true, name: true, workspace: { select: { name: true, color: true } } } },
    },
  });
  return visits.map((v) => ({ ...v.board, visitedAt: v.visitedAt }));
}
