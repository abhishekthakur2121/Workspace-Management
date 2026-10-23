import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { isAppAdmin, isSuperAdmin, visibleBoardWhere, visibleWorkspaceWhere, type Actor } from "@/server/access";

// Everything the sidebar needs: the workspaces and boards this person can
// see, with what they may do there. cache() dedupes the layout's and the
// page's calls within one request (requireUser() returns the same object).
export const getNavData = cache(async (user: Actor) => {
  const superAdmin = isSuperAdmin(user);
  const [workspaces, favorites] = await Promise.all([
    db.workspace.findMany({
      where: { deletedAt: null, ...visibleWorkspaceWhere(user) },
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        members: { where: { userId: user.id }, select: { role: true } },
        boards: {
          where: { deletedAt: null, ...visibleBoardWhere(user) },
          orderBy: { position: "asc" },
          select: { id: true, name: true, workspaceId: true, visibility: true, createdById: true },
        },
      },
    }),
    db.favorite.findMany({
      where: { userId: user.id, board: { deletedAt: null, workspace: { deletedAt: null }, ...visibleBoardWhere(user) } },
      orderBy: { createdAt: "asc" },
      select: { boardId: true },
    }),
  ]);

  return {
    workspaces: workspaces.map(({ members, boards, ...w }) => {
      const me = members[0];
      const isAdmin = superAdmin || me?.role === "admin";
      const isEditor = me?.role === "editor";
      return {
        ...w,
        isAdmin,
        role: superAdmin ? ("admin" as const) : (me?.role ?? null),
        canCreateBoards: isAdmin || isEditor,
        boards: boards.map(({ createdById, ...b }) => ({ ...b, canManage: isAdmin || (isEditor && createdById === user.id) })),
      };
    }),
    favoriteBoardIds: favorites.map((f) => f.boardId),
    canCreateWorkspaces: isAppAdmin(user),
  };
});

export type NavData = Awaited<ReturnType<typeof getNavData>>;
export type NavWorkspace = NavData["workspaces"][number];
export type NavBoard = NavWorkspace["boards"][number];

export async function getRecentBoards(user: Actor, take = 8) {
  const visits = await db.boardVisit.findMany({
    where: { userId: user.id, board: { deletedAt: null, workspace: { deletedAt: null }, ...visibleBoardWhere(user) } },
    orderBy: { visitedAt: "desc" },
    take,
    select: {
      visitedAt: true,
      board: { select: { id: true, name: true, workspace: { select: { name: true, color: true } } } },
    },
  });
  return visits.map((v) => ({ ...v.board, visitedAt: v.visitedAt }));
}
