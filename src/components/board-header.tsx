"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Lock, MoreHorizontal, Share2, Star } from "lucide-react";
import { BoardShareDialog } from "@/components/access/board-share-dialog";
import { Button } from "@/components/ui/button";
import { BoardMenu } from "@/components/board-menu";
import { WorkspaceIcon } from "@/components/ui/avatar";
import { renameBoard, toggleFavorite } from "@/server/actions/boards";
import { cn } from "@/lib/utils";

type Board = {
  id: string;
  name: string;
  workspaceId: string;
  workspace: { id: string; name: string; color: string };
  canManage: boolean;
  visibility: "workspace" | "private";
};

export function BoardHeader({ board, isFavorite }: { board: Board; isFavorite: boolean }) {
  const [favorite, setFavorite] = useState(isFavorite);
  const [sharing, setSharing] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <header className="bg-surface px-6 pt-4 pb-1">
      <Link
        href={`/w/${board.workspace.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
      >
        <WorkspaceIcon name={board.workspace.name} color={board.workspace.color} className="size-4 text-[9px]" />
        {board.workspace.name}
      </Link>
      <div className="mt-1 flex items-center gap-1">
        {board.canManage ? (
          <EditableTitle key={board.name} value={board.name} onSave={(name) => renameBoard({ id: board.id, name })} />
        ) : (
          <h1 className="truncate text-[26px] font-bold tracking-tight">{board.name}</h1>
        )}
        {board.visibility === "private" && (
          <span title="Only selected people can see this board" className="ml-1 inline-flex items-center gap-1 rounded-full bg-hover px-2 py-0.5 text-xs text-muted">
            <Lock className="size-3" /> Private
          </span>
        )}
        <button
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={favorite}
          onClick={() => {
            setFavorite((f) => !f);
            startTransition(() => toggleFavorite({ boardId: board.id }).then(() => undefined));
          }}
          className="rounded-md p-1.5 hover:bg-hover"
        >
          <Star className={cn("size-5", favorite ? "fill-[#ffcb00] text-[#ffcb00]" : "text-muted")} />
        </button>
        <BoardMenu board={board} workspaceName={board.workspace.name} isFavorite={favorite} align="start">
          <button aria-label="Board options" className="rounded-md p-1.5 text-muted hover:bg-hover">
            <MoreHorizontal className="size-5" />
          </button>
        </BoardMenu>
        {board.canManage && (
          <>
            <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setSharing(true)}>
              <Share2 className="size-4" /> Share
            </Button>
            <BoardShareDialog
              boardId={board.id}
              boardName={board.name}
              workspaceName={board.workspace.name}
              open={sharing}
              onOpenChange={setSharing}
            />
          </>
        )}
      </div>
    </header>
  );
}

// Click the title to rename in place, as in monday. Enter saves, Escape cancels.
function EditableTitle({ value, onSave }: { value: string; onSave: (value: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [, startTransition] = useTransition();

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === value) return setDraft(value);
    startTransition(() => onSave(next));
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={80}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="-ml-1.5 min-w-0 rounded-md border border-primary px-1.5 text-[26px] font-bold tracking-tight outline-none ring-2 ring-primary/15"
        size={Math.max(draft.length, 8)}
      />
    );
  }
  return (
    <h1
      title="Click to rename"
      onClick={() => setEditing(true)}
      className="-ml-1.5 cursor-text truncate rounded-md border border-transparent px-1.5 text-[26px] font-bold tracking-tight hover:border-grid"
    >
      {draft}
    </h1>
  );
}
