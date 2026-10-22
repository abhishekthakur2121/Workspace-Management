"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Pencil, Star, StarOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { ConfirmDeleteDialog, NameDialog } from "@/components/dialogs";
import { deleteBoard, renameBoard, restoreBoard, toggleFavorite } from "@/server/actions/boards";

type Board = { id: string; name: string; workspaceId: string };

export function BoardMenu({
  board,
  isFavorite,
  children,
  align = "start",
}: {
  board: Board;
  isFavorite: boolean;
  children: React.ReactNode; // the trigger
  align?: "start" | "end";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
          <MenuItem icon={<Pencil />} onSelect={() => setRenaming(true)}>
            Rename board
          </MenuItem>
          <MenuItem
            icon={isFavorite ? <StarOff /> : <Star />}
            onSelect={() => toggleFavorite({ boardId: board.id })}
          >
            {isFavorite ? "Remove from favorites" : "Add to favorites"}
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger icon={<Trash2 />} onSelect={() => setDeleting(true)}>
            Delete board
          </MenuItem>
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
    </>
  );
}
