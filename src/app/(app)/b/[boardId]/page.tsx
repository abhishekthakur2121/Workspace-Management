import { notFound } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/server/auth-guard";
import { getBoard, recordBoardVisit } from "@/server/queries/board";
import { getNavData } from "@/server/queries/nav";
import { BoardHeader } from "@/components/board-header";

export default async function BoardPage({ params }: PageProps<"/b/[boardId]">) {
  const { boardId } = await params;
  const user = await requireUser();
  const [board, nav] = await Promise.all([getBoard(boardId), getNavData(user.id)]);
  if (!board) notFound();

  // Feeds "Recently visited" on Home; runs after the response is sent.
  after(() => recordBoardVisit(user.id, board.id));

  return (
    <>
      <BoardHeader board={board} isFavorite={nav.favoriteBoardIds.includes(board.id)} />
      <div className="space-y-4 p-6">
        {board.groups.map((g) => (
          <section key={g.id}>
            <h2 className="mb-2 font-semibold" style={{ color: g.color }}>
              {g.name}
            </h2>
            <div className="rounded-lg border border-l-4 border-border bg-surface px-4 py-6 text-center text-sm text-muted" style={{ borderLeftColor: g.color }}>
              The table view with tasks arrives in the next phase.
            </div>
          </section>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          {board.statuses.map((s) => (
            <span key={s.id} className="rounded px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: s.color }}>
              {s.name}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
