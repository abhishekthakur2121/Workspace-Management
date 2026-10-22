import "server-only";
import { db } from "@/server/db";

export async function getBoard(boardId: string) {
  return db.board.findFirst({
    where: { id: boardId, deletedAt: null, workspace: { deletedAt: null } },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      workspace: { select: { id: true, name: true, color: true } },
      groups: {
        where: { deletedAt: null },
        orderBy: { position: "asc" },
        select: { id: true, name: true, color: true },
      },
      statuses: { orderBy: { position: "asc" }, select: { id: true, name: true, color: true } },
    },
  });
}

export async function recordBoardVisit(userId: string, boardId: string) {
  await db.boardVisit.upsert({
    where: { userId_boardId: { userId, boardId } },
    create: { userId, boardId },
    update: { visitedAt: new Date() },
  });
}
