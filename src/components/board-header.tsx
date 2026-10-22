"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal, Star } from "lucide-react";
import { BoardMenu } from "@/components/board-menu";
import { WorkspaceIcon } from "@/components/ui/avatar";
import { renameBoard, toggleFavorite } from "@/server/actions/boards";
import { cn } from "@/lib/utils";

type Board = {
  id: string;
  name: string;
  workspaceId: string;
  workspace: { id: string; name: string; color: string };
};

export function BoardHeader({ board, isFavorite }: { board: Board; isFavorite: boolean }) {
  const [favorite, setFavorite] = useState(isFavorite);
  const [, startTransition] = useTransition();

  return (
    <header className="border-b border-border bg-surface px-6 pt-3 pb-4">
      <Link
        href={`/w/${board.workspace.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
      >
        <WorkspaceIcon name={board.workspace.name} color={board.workspace.color} className="size-4 text-[9px]" />
        {board.workspace.name}
      </Link>
      <div className="mt-1 flex items-center gap-1">
        <EditableTitle key={board.name} value={board.name} onSave={(name) => renameBoard({ id: board.id, name })} />
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
        <BoardMenu board={board} isFavorite={favorite} align="start">
          <button aria-label="Board options" className="rounded-md p-1.5 text-muted hover:bg-hover">
            <MoreHorizontal className="size-5" />
          </button>
        </BoardMenu>
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
        className="-ml-1.5 min-w-0 rounded-md border border-primary px-1.5 text-2xl font-semibold outline-none"
        size={Math.max(draft.length, 8)}
      />
    );
  }
  return (
    <h1
      title="Click to rename"
      onClick={() => setEditing(true)}
      className="-ml-1.5 cursor-text truncate rounded-md border border-transparent px-1.5 text-2xl font-semibold hover:border-border"
    >
      {draft}
    </h1>
  );
}
