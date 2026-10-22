"use client";

import { useState } from "react";
import { CalendarPlus, Plus, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useBoard } from "./board-context";
import { DatePicker, PeoplePicker, PriorityPicker, StatusPicker, TagChip, TagsPicker } from "./pickers";
import { DueBadge } from "@/components/ui/due-badge";
import { LabelPill } from "@/components/ui/label-pill";
import { priorityMeta, type Person, type TaskRow } from "./model";

// Every cell is a full-size button so the whole cell is the click target.
const cellButton =
  "group/cell flex h-full w-full items-center justify-center px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary";

// Status and priority render as a rounded label inset in the cell; an unset
// value is a quiet placeholder rather than a grey block.
function LabelButton({ color, text, empty, ariaLabel }: { color?: string; text: string; empty: string; ariaLabel: string }) {
  return (
    <PopoverTrigger asChild>
      <button className={cn(cellButton, "px-2.5 py-1.5")} aria-label={ariaLabel}>
        <LabelPill color={color} placeholder={empty} className={color ? undefined : "group-hover/cell:border-primary/50 group-hover/cell:text-muted"}>
          {text}
        </LabelPill>
      </button>
    </PopoverTrigger>
  );
}

export function StatusCell({ task }: { task: TaskRow }) {
  const { board, update } = useBoard();
  const status = board.statuses.find((s) => s.id === task.statusId);
  return (
    <StatusPicker boardId={board.id} statuses={board.statuses} value={task.statusId} onChange={(statusId) => update(task.id, { statusId })}>
      <LabelButton color={status?.color} text={status?.name ?? ""} empty="Set status" ariaLabel={`Status: ${status?.name ?? "none"}`} />
    </StatusPicker>
  );
}

export function PriorityCell({ task }: { task: TaskRow }) {
  const { update } = useBoard();
  const meta = priorityMeta(task.priority);
  return (
    <PriorityPicker value={task.priority} onChange={(priority) => update(task.id, { priority })}>
      <LabelButton color={meta?.color} text={meta?.label ?? ""} empty="–" ariaLabel={`Priority: ${meta?.label ?? "none"}`} />
    </PriorityPicker>
  );
}

export function PeopleCell({ task, field }: { task: TaskRow; field: "accountable" | "responsible" }) {
  const { board, update } = useBoard();
  const ids = field === "accountable" ? (task.accountableId ? [task.accountableId] : []) : task.responsibleIds;
  return (
    <PeoplePicker
      people={board.users}
      value={ids}
      multiple={field === "responsible"}
      onChange={(next) =>
        field === "accountable" ? update(task.id, { accountableId: next[0] ?? null }) : update(task.id, { responsibleIds: next })
      }
    >
      <PopoverTrigger asChild>
        <button
          className={cn(cellButton, "hover:bg-hover/60")}
          aria-label={`${field === "accountable" ? "Accountable" : "Responsible"}: ${ids.length} people`}
        >
          <AvatarStack people={ids.map((id) => board.users.find((u) => u.id === id)).filter((p) => p !== undefined)} />
        </button>
      </PopoverTrigger>
    </PeoplePicker>
  );
}

export function AvatarStack({ people, max = 3 }: { people: Person[]; max?: number }) {
  if (!people.length) {
    // Faint silhouette, as in monday, so an empty cell reads as "nobody yet".
    return (
      <span className="relative grid size-7 place-items-center rounded-full border border-dashed border-muted/40 text-muted/50 transition group-hover/cell:border-primary group-hover/cell:text-primary">
        <UserRound className="size-3.5" />
        <Plus className="absolute -right-1 -bottom-1 size-3 rounded-full bg-surface opacity-0 group-hover/cell:opacity-100" />
      </span>
    );
  }
  const shown = people.slice(0, max);
  return (
    <span className="flex -space-x-2">
      {shown.map((p) => (
        <span key={p.id} title={p.name ?? p.email} className={cn("rounded-full ring-2 ring-surface", !p.active && "opacity-40 grayscale")}>
          <Avatar name={p.name ?? p.email} image={p.image} className="size-7 text-[10px]" />
        </span>
      ))}
      {people.length > max && (
        <span className="grid size-7 place-items-center rounded-full bg-hover text-[10px] font-semibold text-muted ring-2 ring-surface">
          +{people.length - max}
        </span>
      )}
    </span>
  );
}

export function DueCell({ task }: { task: TaskRow }) {
  const { board, update } = useBoard();
  const done = board.statuses.find((s) => s.id === task.statusId)?.isDone;
  return (
    <DatePicker value={task.dueDate} onChange={(dueDate) => update(task.id, { dueDate })}>
      <PopoverTrigger asChild>
        <button className={cn(cellButton, "hover:bg-hover/60")} aria-label={`Due date: ${task.dueDate ?? "none"}`}>
          {task.dueDate ? (
            <DueBadge due={task.dueDate} done={done} />
          ) : (
            <CalendarPlus className="size-4 text-muted/40 transition group-hover/cell:text-primary" />
          )}
        </button>
      </PopoverTrigger>
    </DatePicker>
  );
}

export function TagsCell({ task }: { task: TaskRow }) {
  const { board, update, addTag } = useBoard();
  const tags = task.tagIds.map((id) => board.tags.find((t) => t.id === id)).filter((t) => t !== undefined);
  return (
    <TagsPicker boardId={board.id} tags={board.tags} value={task.tagIds} onChange={(tagIds) => update(task.id, { tagIds })} onTagCreated={addTag}>
      <PopoverTrigger asChild>
        <button className={cn(cellButton, "gap-1 overflow-hidden hover:bg-hover/60", tags.length && "justify-start")} aria-label={`Tags: ${tags.length}`}>
          {tags.length ? (
            tags.map((t) => <TagChip key={t.id} tag={t} />)
          ) : (
            <span className="inline-flex items-center gap-0.5 text-xs text-primary opacity-0 transition group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100">
              <Plus className="size-3.5" /> Tag
            </span>
          )}
        </button>
      </PopoverTrigger>
    </TagsPicker>
  );
}

// Click to rename in place. Opens straight into editing for a task just
// created from the toolbar.
export function NameEditor({ task, className }: { task: TaskRow; className?: string }) {
  const { update, autoEditId, setAutoEditId } = useBoard();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.name);
  const isEditing = editing || autoEditId === task.id;

  function stop(save: boolean) {
    setEditing(false);
    if (autoEditId === task.id) setAutoEditId(null);
    const next = draft.trim();
    if (save && next && next !== task.name) update(task.id, { name: next });
    else setDraft(task.name);
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={500}
        onFocus={(e) => e.currentTarget.select()}
        // Selecting text with the mouse must not start dragging the row/card.
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => stop(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") stop(true);
          if (e.key === "Escape") stop(false);
        }}
        className={cn("h-7 min-w-0 flex-1 rounded-md border border-primary bg-surface px-2 text-sm shadow-sm outline-none ring-2 ring-primary/15", className)}
      />
    );
  }
  return (
    <button
      onClick={() => {
        setDraft(task.name);
        setEditing(true);
      }}
      title={task.name}
      disabled={task.id.startsWith("temp-")}
      className={cn(
        "min-w-0 truncate rounded-md border border-transparent px-2 py-0.5 text-left text-sm text-foreground hover:border-grid hover:bg-surface",
        className,
      )}
    >
      {task.name}
    </button>
  );
}
