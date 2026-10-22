"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical, ListTree, MessageCircle, MoreHorizontal, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { useBoard } from "../board-context";
import { DueCell, NameEditor, PeopleCell, PriorityCell, StatusCell, TagsCell } from "../cells";
import type { ColumnKey, TaskRow } from "../model";
import { AddSubtaskRow } from "./add-rows";
import type { Section, TableProps } from "./layout";

// A task row plus, when expanded, its subtasks and an "add subtask" row.
export function TaskRows({ task, section, template, ...props }: TableProps & { task: TaskRow; section: Section; template: string }) {
  const { tasks } = useBoard();
  const [expanded, setExpanded] = useState(false);
  const subtasks = tasks.filter((t) => t.parentId === task.id);
  const visibleSubtasks = subtasks.filter(props.subtaskFilter);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { groupId: task.groupId },
    disabled: !props.canDrag || section.kind !== "group" || task.id.startsWith("temp-"),
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative bg-surface transition-shadow", isDragging && "z-10 rounded-md shadow-2xl ring-1 ring-primary/30")}
    >
      <Row
        task={task}
        template={template}
        columns={props.columns}
        selected={props.selected.has(task.id)}
        onSelect={(on) => props.onSelect([task.id], on)}
        dragHandle={
          props.canDrag && section.kind === "group" ? (
            <button
              aria-label={`Drag ${task.name}`}
              className="absolute left-0 cursor-grab p-0.5 text-muted opacity-0 group-hover/row:opacity-100 focus:opacity-100"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-3.5" />
            </button>
          ) : null
        }
        expandControl={
          <button
            aria-label={expanded ? "Hide subtasks" : "Show subtasks"}
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
            className={cn(
              "flex shrink-0 items-center rounded p-0.5 text-muted hover:bg-hover",
              !subtasks.length && !expanded && "opacity-0 group-hover/row:opacity-100 focus:opacity-100",
            )}
          >
            <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
          </button>
        }
        subtaskCount={subtasks.length}
        onAddSubtask={() => setExpanded(true)}
      />
      {expanded && (
        <div className="bg-background/60">
          {visibleSubtasks.map((sub) => (
            <Row
              key={sub.id}
              task={sub}
              template={template}
              columns={props.columns}
              selected={props.selected.has(sub.id)}
              onSelect={(on) => props.onSelect([sub.id], on)}
              depth={1}
            />
          ))}
          <AddSubtaskRow parent={task} template={template} />
        </div>
      )}
    </div>
  );
}

function Row({
  task,
  template,
  columns,
  selected,
  onSelect,
  depth = 0,
  dragHandle,
  expandControl,
  subtaskCount,
  onAddSubtask,
}: {
  task: TaskRow;
  template: string;
  columns: ColumnKey[];
  selected: boolean;
  onSelect: (on: boolean) => void;
  depth?: number;
  dragHandle?: React.ReactNode;
  expandControl?: React.ReactNode;
  subtaskCount?: number;
  onAddSubtask?: () => void;
}) {
  const pending = task.id.startsWith("temp-");
  return (
    <div
      role="row"
      className={cn(
        "group/row grid h-10 border-b border-grid transition-colors duration-150",
        pending && "anim-row",
        selected ? "bg-selected/40" : "hover:bg-background/70",
        pending && "opacity-60",
      )}
      style={{ gridTemplateColumns: template }}
    >
      <div className="relative grid place-items-center border-r border-grid">
        {dragHandle}
        <Checkbox checked={selected} onChange={onSelect} label={`Select ${task.name}`} disabled={pending} />
      </div>
      <div className={cn("flex min-w-0 items-center gap-1 border-r border-grid pr-1", depth ? "pl-9" : "pl-2")}>
        {depth > 0 && <span className="mr-1 h-4 w-3 shrink-0 rounded-bl border-b border-l border-border" />}
        {expandControl}
        <NameEditor task={task} />
        {!!subtaskCount && (
          <span className="flex shrink-0 items-center gap-0.5 rounded bg-hover px-1 text-[11px] text-muted" title={`${subtaskCount} subtasks`}>
            <ListTree className="size-3" />
            {subtaskCount}
          </span>
        )}
        <span className="flex-1" />
        {!pending && <OpenTaskButton task={task} />}
        {!pending && <RowMenu task={task} onAddSubtask={onAddSubtask} />}
      </div>
      {columns.map((k) => (
        <div key={k} className="min-w-0 border-r border-grid last:border-r-0">
          {pending ? null : <Cell column={k} task={task} />}
        </div>
      ))}
    </div>
  );
}

function Cell({ column, task }: { column: ColumnKey; task: TaskRow }) {
  switch (column) {
    case "accountable":
      return <PeopleCell task={task} field="accountable" />;
    case "responsible":
      return <PeopleCell task={task} field="responsible" />;
    case "status":
      return <StatusCell task={task} />;
    case "due":
      return <DueCell task={task} />;
    case "priority":
      return <PriorityCell task={task} />;
    case "tags":
      return <TagsCell task={task} />;
  }
}

// Opens the task panel; shows the number of updates like monday's speech bubble.
export function OpenTaskButton({ task }: { task: TaskRow }) {
  const { openTask } = useBoard();
  const n = task.commentCount;
  return (
    <button
      onClick={() => openTask(task.id)}
      aria-label={n ? `Open ${task.name} (${n} updates)` : `Open ${task.name}`}
      title="Open task"
      className={cn(
        "relative shrink-0 rounded-md p-1 transition hover:bg-hover",
        n ? "text-primary" : "text-muted opacity-0 group-hover/row:opacity-100 focus:opacity-100",
      )}
    >
      <MessageCircle className="size-4" />
      {n > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-0.5 text-[9px] leading-none font-semibold text-white">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </button>
  );
}

function RowMenu({ task, onAddSubtask }: { task: TaskRow; onAddSubtask?: () => void }) {
  const { remove } = useBoard();
  // Non-modal: "Add subtask" focuses a field, which a focus-trapping menu would steal back.
  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <button
          aria-label={`${task.name} options`}
          className="shrink-0 rounded p-1 text-muted opacity-0 group-hover/row:opacity-100 hover:bg-hover focus:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </MenuTrigger>
      <MenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
        {onAddSubtask && (
          <MenuItem icon={<ListTree />} onSelect={onAddSubtask}>
            Add subtask
          </MenuItem>
        )}
        <MenuItem danger icon={<Trash2 />} onSelect={() => remove([task.id])}>
          Delete {task.parentId ? "subtask" : "task"}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
