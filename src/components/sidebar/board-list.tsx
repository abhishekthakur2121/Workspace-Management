"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ownEventsOnly, restrictToVerticalAxis } from "@/lib/dnd";
import { CSS } from "@dnd-kit/utilities";
import { LayoutGrid, Lock, MoreHorizontal } from "lucide-react";
import { BoardMenu } from "@/components/board-menu";
import { reorderBoard } from "@/server/actions/boards";
import type { NavBoard } from "@/server/queries/nav";
import { cn } from "@/lib/utils";

export function BoardList({
  boards,
  favoriteIds,
  activeBoardId,
}: {
  boards: NavBoard[];
  favoriteIds: string[];
  activeBoardId?: string;
}) {
  // Local copy so a drop shows instantly; resynced whenever the server sends new data.
  const [items, setItems] = useState(boards);
  const [source, setSource] = useState(boards);
  if (boards !== source) {
    setSource(boards);
    setItems(boards);
  }
  const [, startTransition] = useTransition();
  // Stable id so dnd-kit's generated aria attributes match between server and client.
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((b) => b.id === active.id);
    const to = items.findIndex((b) => b.id === over.id);
    const next = arrayMove(items, from, to);
    setItems(next);
    startTransition(() =>
      reorderBoard({ id: String(active.id), prevId: next[to - 1]?.id ?? null, nextId: next[to + 1]?.id ?? null }),
    );
  }

  if (items.length === 0) {
    return <p className="px-3 py-2 text-sm text-muted">No boards yet</p>;
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-0.5">
          {items.map((board) => (
            <SortableBoard
              key={board.id}
              board={board}
              active={board.id === activeBoardId}
              isFavorite={favoriteIds.includes(board.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableBoard({ board, active, isFavorite }: { board: NavBoard; active: boolean; isFavorite: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: board.id, disabled: !board.canManage }); // only managers may reorder

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-80")}
      {...attributes}
      {...ownEventsOnly(listeners)}
      // The row holds a link and a menu button, so it must not itself be a button.
      role="listitem"
    >
      <BoardLink board={board} active={active} isFavorite={isFavorite} />
    </li>
  );
}

export function BoardLink({ board, active, isFavorite }: { board: NavBoard; active: boolean; isFavorite: boolean }) {
  return (
    <div
      className={cn(
        "group relative flex items-center rounded-md text-sm transition-colors duration-150",
        "before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:transition-transform before:duration-200",
        active ? "bg-selected font-medium text-primary before:scale-y-100" : "before:scale-y-0 hover:bg-hover",
      )}
    >
      <Link href={`/b/${board.id}`} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5" draggable={false}>
        <LayoutGrid className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted")} />
        <span className="truncate">{board.name}</span>
        {board.visibility === "private" && <Lock aria-label="Private board" className="size-3 shrink-0 text-muted" />}
      </Link>
      <BoardMenu board={board} isFavorite={isFavorite}>
        <button
          aria-label={`${board.name} options`}
          onPointerDown={(e) => e.stopPropagation()}
          className="mr-1 rounded p-1 text-muted opacity-0 group-hover:opacity-100 hover:bg-border/60 focus:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </BoardMenu>
    </div>
  );
}
