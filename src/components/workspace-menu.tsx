"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Pencil, Trash2, Users } from "lucide-react";
import { WorkspaceMembersDialog } from "@/components/access/workspace-members-dialog";
import { toast } from "sonner";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { ConfirmDeleteDialog, NameDialog } from "@/components/dialogs";
import {
  deleteWorkspace,
  moveWorkspace,
  renameWorkspace,
  restoreWorkspace,
  setWorkspaceColor,
} from "@/server/actions/workspaces";
import { PALETTE } from "@/lib/utils";

type Workspace = { id: string; name: string; color: string; boards: { id: string }[] };

// Only rendered for workspace admins (and super admins).
export function WorkspaceMenu({
  workspace,
  isFirst,
  isLast,
  children,
  align = "start",
}: {
  workspace: Workspace;
  isFirst: boolean;
  isLast: boolean;
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  async function remove() {
    await deleteWorkspace({ id: workspace.id });
    const viewingIt =
      pathname === `/w/${workspace.id}` || workspace.boards.some((b) => pathname === `/b/${b.id}`);
    if (viewingIt) router.push("/");
    toast(`Deleted "${workspace.name}"`, {
      action: { label: "Undo", onClick: () => restoreWorkspace({ id: workspace.id }) },
    });
  }

  return (
    <>
      <Menu>
        <MenuTrigger asChild>{children}</MenuTrigger>
        <MenuContent align={align}>
          <MenuItem icon={<Users />} onSelect={() => setMembersOpen(true)}>
            Members…
          </MenuItem>
          <MenuItem icon={<Pencil />} onSelect={() => setRenaming(true)}>
            Rename workspace
          </MenuItem>
          <MenuLabel>Color</MenuLabel>
          <div className="grid grid-cols-5 gap-1.5 px-2.5 pb-2">
            {PALETTE.map((color) => (
              <MenuItem
                key={color}
                aria-label={`Color ${color}`}
                onSelect={() => setWorkspaceColor({ id: workspace.id, color })}
                className="grid size-6 place-items-center rounded-md p-0 text-white data-highlighted:bg-transparent data-highlighted:ring-2 data-highlighted:ring-offset-1"
                style={{ backgroundColor: color, ["--tw-ring-color" as string]: color }}
              >
                {workspace.color === color && <Check className="size-3.5" />}
              </MenuItem>
            ))}
          </div>
          <MenuSeparator />
          <MenuItem icon={<ArrowUp />} disabled={isFirst} onSelect={() => moveWorkspace({ id: workspace.id, direction: "up" })}>
            Move up
          </MenuItem>
          <MenuItem icon={<ArrowDown />} disabled={isLast} onSelect={() => moveWorkspace({ id: workspace.id, direction: "down" })}>
            Move down
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger icon={<Trash2 />} onSelect={() => setDeleting(true)}>
            Delete workspace
          </MenuItem>
        </MenuContent>
      </Menu>
      <NameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename workspace"
        label="Workspace name"
        initialValue={workspace.name}
        submitLabel="Save"
        onSubmit={(name) => renameWorkspace({ id: workspace.id, name })}
      />
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        kind="workspace"
        name={workspace.name}
        extra={`and its ${workspace.boards.length} board${workspace.boards.length === 1 ? "" : "s"} will be deleted.`}
        onConfirm={remove}
      />
      <WorkspaceMembersDialog workspaceId={workspace.id} workspaceName={workspace.name} open={membersOpen} onOpenChange={setMembersOpen} />
    </>
  );
}
