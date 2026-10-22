import Link from "next/link";
import { Clock, LayoutGrid, Plus } from "lucide-react";
import { requireUser } from "@/server/auth-guard";
import { getNavData, getRecentBoards } from "@/server/queries/nav";
import { PageHeader } from "@/components/page-header";
import { WorkspaceIcon } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CreateWorkspaceButton } from "@/components/create-buttons";

export default async function HomePage() {
  const user = await requireUser();
  const [recent, nav] = await Promise.all([getRecentBoards(user.id), getNavData(user.id)]);
  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <>
      <PageHeader title={`Hi ${firstName} 👋`} subtitle="Pick up where you left off." />
      <div className="space-y-8 p-6">
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Clock className="size-4 text-muted" /> Recently visited
          </h2>
          {recent.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recent.map((b) => (
                <Link
                  key={b.id}
                  href={`/b/${b.id}`}
                  className="rounded-lg border border-border bg-surface p-4 transition hover:shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="size-4 text-muted" />
                    <span className="truncate font-medium">{b.name}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                    <WorkspaceIcon name={b.workspace.name} color={b.workspace.color} className="size-4 text-[9px]" />
                    {b.workspace.name}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Boards you open will show up here.</p>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Workspaces</h2>
            <CreateWorkspaceButton>
              <Button size="sm" variant="secondary">
                <Plus className="size-4" /> New workspace
              </Button>
            </CreateWorkspaceButton>
          </div>
          {nav.workspaces.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {nav.workspaces.map((w) => (
                <Link
                  key={w.id}
                  href={`/w/${w.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition hover:shadow-md"
                >
                  <WorkspaceIcon name={w.name} color={w.color} className="size-10 text-base" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{w.name}</div>
                    <div className="text-xs text-muted">
                      {w.boards.length} board{w.boards.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
              <p className="font-medium">No workspaces yet</p>
              <p className="mt-1 text-sm text-muted">Create one for each client or team to get started.</p>
              <CreateWorkspaceButton>
                <Button className="mt-4">
                  <Plus className="size-4" /> Create workspace
                </Button>
              </CreateWorkspaceButton>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
