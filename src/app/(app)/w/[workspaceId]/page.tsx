import Link from "next/link";
import { notFound } from "next/navigation";
import { LayoutGrid, MoreHorizontal, Plus } from "lucide-react";
import { requireUser } from "@/server/auth-guard";
import { getNavData } from "@/server/queries/nav";
import { PageHeader } from "@/components/page-header";
import { WorkspaceIcon } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CreateBoardButton } from "@/components/create-buttons";
import { WorkspaceMenu } from "@/components/workspace-menu";
import { BoardMenu } from "@/components/board-menu";

export default async function WorkspacePage({ params }: PageProps<"/w/[workspaceId]">) {
  const { workspaceId } = await params;
  const user = await requireUser();
  const nav = await getNavData(user.id);
  const index = nav.workspaces.findIndex((w) => w.id === workspaceId);
  const workspace = nav.workspaces[index];
  if (!workspace) notFound();

  const newBoard = (
    <CreateBoardButton workspaceId={workspace.id}>
      <Button>
        <Plus className="size-4" /> New board
      </Button>
    </CreateBoardButton>
  );

  return (
    <>
      <PageHeader
        icon={<WorkspaceIcon name={workspace.name} color={workspace.color} className="size-10 text-base" />}
        title={workspace.name}
        subtitle={`${workspace.boards.length} board${workspace.boards.length === 1 ? "" : "s"}`}
        actions={
          <>
            {newBoard}
            <WorkspaceMenu
              workspace={workspace}
              isFirst={index === 0}
              isLast={index === nav.workspaces.length - 1}
              align="end"
            >
              <Button variant="ghost" size="icon" aria-label="Workspace options" className="size-9">
                <MoreHorizontal className="size-5" />
              </Button>
            </WorkspaceMenu>
          </>
        }
      />
      <div className="p-6">
        {workspace.boards.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {workspace.boards.map((b) => (
              <div key={b.id} className="group relative rounded-lg border border-border bg-surface transition hover:shadow-md">
                <Link href={`/b/${b.id}`} className="flex items-center gap-2 p-4 pr-10">
                  <LayoutGrid className="size-4 text-muted" />
                  <span className="truncate font-medium">{b.name}</span>
                </Link>
                <div className="absolute top-3 right-2">
                  <BoardMenu board={b} isFavorite={nav.favoriteBoardIds.includes(b.id)} align="end">
                    <button
                      aria-label={`${b.name} options`}
                      className="rounded p-1 text-muted opacity-0 group-hover:opacity-100 hover:bg-hover focus:opacity-100 data-[state=open]:opacity-100"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </BoardMenu>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
            <p className="font-medium">No boards in {workspace.name} yet</p>
            <p className="mt-1 mb-4 text-sm text-muted">A board holds one stream of work, like &quot;Digital Operations&quot;.</p>
            {newBoard}
          </div>
        )}
      </div>
    </>
  );
}
