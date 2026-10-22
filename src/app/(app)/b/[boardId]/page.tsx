import { notFound } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/server/auth-guard";
import { getBoardData, recordBoardVisit } from "@/server/queries/board";
import { getNavData } from "@/server/queries/nav";
import { BoardHeader } from "@/components/board-header";
import { BoardView } from "@/components/board/board-view";

export default async function BoardPage({ params }: PageProps<"/b/[boardId]">) {
  const { boardId } = await params;
  const user = await requireUser();
  const [board, nav] = await Promise.all([getBoardData(boardId), getNavData(user.id)]);
  if (!board) notFound();

  // Feeds "Recently visited" on Home; runs after the response is sent.
  after(() => recordBoardVisit(user.id, board.id));

  return (
    <>
      <BoardHeader board={board} isFavorite={nav.favoriteBoardIds.includes(board.id)} />
      <BoardView board={board} currentUserId={user.id} isAdmin={user.role === "admin"} />
    </>
  );
}
