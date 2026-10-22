"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { Check, ChevronsUpDown, MoreHorizontal, Plus, Search } from "lucide-react";
import { WorkspaceIcon } from "@/components/ui/avatar";
import { WorkspaceMenu } from "@/components/workspace-menu";
import { CreateWorkspaceDialog } from "@/components/create-buttons";
import type { NavWorkspace } from "@/server/queries/nav";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({
  workspaces,
  current,
}: {
  workspaces: NavWorkspace[];
  current?: NavWorkspace;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = workspaces.filter((w) => w.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <Popover.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
      >
        <Popover.Trigger asChild>
          <button className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-sm hover:bg-hover">
            {current ? (
              <>
                <WorkspaceIcon name={current.name} color={current.color} />
                <span className="flex-1 truncate font-medium">{current.name}</span>
              </>
            ) : (
              <span className="flex-1 text-muted">Choose a workspace</span>
            )}
            <ChevronsUpDown className="size-4 text-muted" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 w-(--radix-popover-trigger-width) min-w-64 rounded-lg border border-border bg-surface p-1.5 shadow-lg"
          >
            <div className="mb-1 flex items-center gap-2 rounded-md border border-border px-2">
              <Search className="size-4 text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workspaces"
                className="h-8 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filtered.map((w) => {
                const index = workspaces.indexOf(w);
                return (
                  <div key={w.id} className="group flex items-center rounded-md hover:bg-hover">
                    <button
                      onClick={() => {
                        setOpen(false);
                        router.push(`/w/${w.id}`);
                      }}
                      className="flex flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
                    >
                      <WorkspaceIcon name={w.name} color={w.color} />
                      <span className="flex-1 truncate">{w.name}</span>
                      {w.id === current?.id && <Check className="size-4 text-primary" />}
                    </button>
                    <WorkspaceMenu workspace={w} isFirst={index === 0} isLast={index === workspaces.length - 1} align="end">
                      <button
                        aria-label={`${w.name} options`}
                        className="mr-1 rounded p-1 text-muted opacity-0 group-hover:opacity-100 hover:bg-border/60 focus:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </WorkspaceMenu>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-2 py-3 text-center text-sm text-muted">
                  {workspaces.length ? "No matching workspaces" : "No workspaces yet"}
                </p>
              )}
            </div>
            <div className="mt-1 border-t border-border pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  setCreating(true);
                }}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary hover:bg-hover")}
              >
                <Plus className="size-4" /> Add workspace
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <CreateWorkspaceDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
