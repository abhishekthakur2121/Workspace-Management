"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Pencil, Share2, Star, StarOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { ConfirmDeleteDialog, NameDialog } from "@/components/dialogs";
import { deleteBoard, renameBoard, restoreBoard, toggleFavorite } from "@/server/actions/boards";
import { BoardShareDialog } from "@/components/access/board-share-dialog";

// canManage: the board's creator, workspace admins and super admins may
// rename, share and delete it; everyone who can see it may favourite it.
type Board = { id: string; name: string; workspaceId: string; canManage?: boolean };

export function BoardMenu({
  board,
  isFavorite,
  children,
  align = "start",
  workspaceName = "the workspace",
}: {
  board: Board;
  isFavorite: boolean;
  workspaceName?: string;
  children: React.ReactNode; // the trigger
  align?: "start" | "end";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const canManage = !!board.canManage;

  async function remove() {
    await deleteBoard({ id: board.id });
    if (pathname === `/b/${board.id}`) router.push(`/w/${board.workspaceId}`);
    toast(`Deleted "${board.name}"`, {
      action: { label: "Undo", onClick: () => restoreBoard({ id: board.id }) },
    });
  }

  return (
    <>
      <Menu>
        <MenuTrigger asChild>{children}</MenuTrigger>
        <MenuContent align={align}>
          {canManage && (
            <>
              <MenuItem icon={<Pencil />} onSelect={() => setRenaming(true)}>
                Rename board
              </MenuItem>
              <MenuItem icon={<Share2 />} onSelect={() => setSharing(true)}>
                Share…
              </MenuItem>
            </>
          )}
          <MenuItem
            icon={isFavorite ? <StarOff /> : <Star />}
            onSelect={() => toggleFavorite({ boardId: board.id })}
          >
            {isFavorite ? "Remove from favorites" : "Add to favorites"}
          </MenuItem>
          {canManage && (
            <>
              <MenuSeparator />
              <MenuItem danger icon={<Trash2 />} onSelect={() => setDeleting(true)}>
                Delete board
              </MenuItem>
            </>
          )}
        </MenuContent>
      </Menu>
      <NameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename board"
        label="Board name"
        initialValue={board.name}
        submitLabel="Save"
        onSubmit={(name) => renameBoard({ id: board.id, name })}
      />
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        kind="board"
        name={board.name}
        extra="and all of its groups and tasks will be deleted."
        onConfirm={remove}
      />
      {canManage && (
        <BoardShareDialog boardId={board.id} boardName={board.name} workspaceName={workspaceName} open={sharing} onOpenChange={setSharing} />
      )}
    </>
  );
}
