"use client";

import { useId, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, CalendarPlus, ListTree, MessageCircle, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ownEventsOnly } from "@/lib/dnd";
import { useBoard } from "./board-context";
import { AvatarStack, NameEditor } from "./cells";
import { DatePicker, PeoplePicker, PriorityPicker, TagChip } from "./pickers";
import { formatDue, isOverdue } from "@/lib/dates";
import { NO_STATUS, priorityMeta, type ColumnKey, type Sort, type TaskRow } from "./model";

type Column = { id: string; name: string; color: string; statusId: string | null };

const isTemp = (id: string) => id.startsWith("temp-");

export function KanbanBoard({ cards, hidden, sort }: { cards: TaskRow[]; hidden: ColumnKey[]; sort: Sort }) {
  const { board, tasks, moveCard } = useBoard();
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const hasNoStatus = cards.some((t) => !t.statusId);
  const columns: Column[] = [
    ...board.statuses.map((s) => ({ id: s.id, name: s.name, color: s.color, statusId: s.id })),
    ...(hasNoStatus ? [{ id: NO_STATUS, name: "No status", color: "#9699a6", statusId: null }] : []),
  ];

  // Card ids per column, in display order. While dragging, a local copy lets
  // cards move between columns live; it is committed on drop.
  const derived = useMemo(() => {
    const byColumn: Record<string, string[]> = {};
    for (const c of columns) byColumn[c.id] = [];
    const ordered = sort ? cards : [...cards].sort((a, b) => (a.kanbanPosition < b.kanbanPosition ? -1 : a.kanbanPosition > b.kanbanPosition ? 1 : 0));
    for (const t of ordered) byColumn[t.statusId ?? NO_STATUS]?.push(t.id);
    return byColumn;
    // columns is derived from board.statuses + cards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, sort, board.statuses]);
  const [dragging, setDragging] = useState<{ id: string; columns: Record<string, string[]> } | null>(null);
  const layout = dragging?.columns ?? derived;
  const byId = new Map(cards.map((t) => [t.id, t]));
  const canDrag = !sort;

  const columnOf = (id: string, cols: Record<string, string[]>) =>
    id in cols ? id : Object.keys(cols).find((c) => cols[c].includes(id));

  function onDragStart({ active }: DragStartEvent) {
    setDragging({ id: String(active.id), columns: structuredClone(derived) });
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !dragging) return;
    const from = columnOf(String(active.id), dragging.columns);
    const to = columnOf(String(over.id), dragging.columns);
    if (!from || !to || from === to) return;
    setDragging((d) => {
      if (!d) return d;
      const cols = { ...d.columns, [from]: d.columns[from].filter((x) => x !== active.id) };
      const target = [...cols[to]];
      const overIndex = target.indexOf(String(over.id));
      target.splice(overIndex === -1 ? target.length : overIndex, 0, String(active.id));
      cols[to] = target;
      return { ...d, columns: cols };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const state = dragging;
    setDragging(null);
    if (!over || !state) return;
    const id = String(active.id);
    const col = columnOf(id, state.columns);
    if (!col) return;
    let list = state.columns[col];
    // Reorder within the column to where it was dropped.
    if (!(over.id in state.columns) && over.id !== id) {
      const from = list.indexOf(id);
      const to = list.indexOf(String(over.id));
      if (from !== -1 && to !== -1) {
        list = [...list];
        list.splice(to, 0, ...list.splice(from, 1));
      }
    }
    const original = tasks.find((t) => t.id === id);
    const statusId = columns.find((c) => c.id === col)?.statusId ?? null;
    const index = list.indexOf(id);
    const neighbour = (i: number) => {
      const nid = list[i];
      return nid && !isTemp(nid) ? nid : null;
    };
    const unchanged = original?.statusId === statusId && derived[col]?.join() === list.join();
    if (!unchanged) moveCard(id, statusId, neighbour(index - 1), neighbour(index + 1));
  }

  const active = dragging ? byId.get(dragging.id) : undefined;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto px-6 pt-4 pb-24">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            ids={layout[col.id] ?? []}
            byId={byId}
            hidden={hidden}
            canDrag={canDrag}
            draggingId={dragging?.id}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {active ? <Card task={active} hidden={hidden} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  column,
  ids,
  byId,
  hidden,
  canDrag,
  draggingId,
}: {
  column: Column;
  ids: string[];
  byId: Map<string, TaskRow>;
  hidden: ColumnKey[];
  canDrag: boolean;
  draggingId?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section aria-label={`${column.name} column`} className="flex w-72 shrink-0 flex-col">
      <header
        className="flex items-center gap-2 rounded-t-xl border border-b-0 border-grid px-3 py-2.5"
        style={{ backgroundColor: `color-mix(in srgb, ${column.color} 10%, var(--surface))`, borderTop: `3px solid ${column.color}` }}
      >
        <h2 className="neon-pill h-7 max-w-full min-w-0 px-3 text-[13px]" style={{ "--c": column.color } as React.CSSProperties}>
          <span className="truncate">{column.name}</span>
        </h2>
        <span className="ml-auto rounded-full bg-surface/70 px-2 py-0.5 text-xs font-semibold text-muted">{ids.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-b-xl border border-t-0 border-grid bg-hover/35 p-2 transition-colors duration-200",
          isOver && "bg-selected/40 ring-2 ring-primary/20 ring-inset",
        )}
      >
        <SortableContext id={column.id} items={ids} strategy={verticalListSortingStrategy} disabled={!canDrag}>
          {ids.map((id) => {
            const task = byId.get(id);
            return task ? <SortableCard key={id} task={task} hidden={hidden} canDrag={canDrag} ghost={id === draggingId} /> : null;
          })}
        </SortableContext>
        {ids.length === 0 && (
          <div className="grid h-20 place-items-center rounded-lg border border-dashed border-border text-xs text-muted">Drop tasks here</div>
        )}
        <AddCard column={column} />
      </div>
    </section>
  );
}

function SortableCard({ task, hidden, canDrag, ghost }: { task: TaskRow; hidden: ColumnKey[]; canDrag: boolean; ghost: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
    disabled: !canDrag || isTemp(task.id),
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(ghost && "opacity-40")}
      {...attributes}
      {...ownEventsOnly(listeners)}
      // Contains buttons (pickers, menu), so the wrapper itself isn't a button.
      role="listitem"
      aria-roledescription="Draggable task card"
    >
      <Card task={task} hidden={hidden} />
    </div>
  );
}

function Card({ task, hidden, overlay }: { task: TaskRow; hidden: ColumnKey[]; overlay?: boolean }) {
  const { board, tasks, update, remove, openTask } = useBoard();
  const show = (k: ColumnKey) => !hidden.includes(k);
  const group = board.groups.find((g) => g.id === task.groupId);
  const status = board.statuses.find((s) => s.id === task.statusId);
  const priority = priorityMeta(task.priority);
  const overdue = isOverdue(task.dueDate, status?.isDone);
  const subtasks = tasks.filter((t) => t.parentId === task.id).length;
  const people = [task.accountableId, ...task.responsibleIds]
    .filter((id, i, all): id is string => !!id && all.indexOf(id) === i)
    .map((id) => board.users.find((u) => u.id === id))
    .filter((u) => u !== undefined);
  const tags = task.tagIds.map((id) => board.tags.find((t) => t.id === id)).filter((t) => t !== undefined);

  return (
    <article
      className={cn(
        "group/card card-shadow rounded-xl border border-grid bg-surface p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        overlay && "rotate-2 cursor-grabbing shadow-2xl ring-1 ring-primary/30",
        isTemp(task.id) && "anim-row opacity-60",
      )}
    >
      <div className="flex items-start gap-1">
        <div className="-mx-2 -my-0.5 flex min-w-0 flex-1">
          <NameEditor task={task} className="font-medium whitespace-normal" />
        </div>
        {!overlay && !isTemp(task.id) && (
          <Menu>
            <MenuTrigger asChild>
              <button
                aria-label={`${task.name} options`}
                className="rounded p-0.5 text-muted opacity-0 group-hover/card:opacity-100 hover:bg-hover focus:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem danger icon={<Trash2 />} onSelect={() => remove([task.id])}>
                Delete task
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>

      {group && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <span className="size-2 rounded-full" style={{ backgroundColor: group.color }} />
          <span className="truncate">{group.name}</span>
        </div>
      )}

      {(show("priority") || show("due") || (show("tags") && tags.length > 0)) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {show("priority") && (
            <PriorityPicker value={task.priority} onChange={(p) => update(task.id, { priority: p })}>
              <PopoverTrigger asChild>
                <button
                  disabled={isTemp(task.id)}
                  aria-label={`Priority: ${priority?.label ?? "none"}`}
                  className={cn(
                    "h-6 px-2.5 text-xs",
                    priority ? "neon-pill neon-interactive" : "rounded-full border-[1.5px] border-dashed border-border text-muted transition hover:bg-hover",
                  )}
                  style={priority ? ({ "--c": priority.color } as React.CSSProperties) : undefined}
                >
                  {priority?.label ?? "Priority"}
                </button>
              </PopoverTrigger>
            </PriorityPicker>
          )}
          {show("due") && (
            <DatePicker value={task.dueDate} onChange={(dueDate) => update(task.id, { dueDate })}>
              <PopoverTrigger asChild>
                <button
                  disabled={isTemp(task.id)}
                  aria-label={`Due date: ${task.dueDate ?? "none"}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition",
                    overdue ? "bg-danger/10 font-medium text-danger" : "bg-label-empty text-muted hover:bg-hover",
                    status?.isDone && task.dueDate && "line-through",
                  )}
                >
                  {overdue ? <AlertCircle className="size-3" /> : !task.dueDate && <CalendarPlus className="size-3" />}
                  {task.dueDate ? formatDue(task.dueDate) : "Due"}
                </button>
              </PopoverTrigger>
            </DatePicker>
          )}
          {show("tags") && tags.map((t) => <TagChip key={t.id} tag={t} />)}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        {show("responsible") || show("accountable") ? (
          <span>
            <PeoplePicker
              people={board.users}
              value={task.responsibleIds}
              multiple
              onChange={(responsibleIds) => update(task.id, { responsibleIds })}
            >
              <PopoverTrigger asChild>
                <button disabled={isTemp(task.id)} className="group/cell rounded-full" aria-label={`People: ${people.length}`}>
                  <AvatarStack people={people} />
                </button>
              </PopoverTrigger>
            </PeoplePicker>
          </span>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-2">
          {subtasks > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted" title={`${subtasks} subtasks`}>
              <ListTree className="size-3.5" /> {subtasks}
            </span>
          )}
          {!overlay && !isTemp(task.id) && (
            <button
              onClick={() => openTask(task.id)}
              aria-label={task.commentCount ? `Open ${task.name} (${task.commentCount} updates)` : `Open ${task.name}`}
              className={cn(
                "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition hover:bg-hover",
                task.commentCount ? "text-primary" : "text-muted opacity-0 group-hover/card:opacity-100 focus:opacity-100",
              )}
            >
              <MessageCircle className="size-3.5" />
              {task.commentCount > 0 && task.commentCount}
            </button>
          )}
        </span>
      </div>
    </article>
  );
}

function AddCard({ column }: { column: Column }) {
  const { board, create } = useBoard();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const groupId = board.groups[0]?.id;
  if (!groupId) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm text-muted transition hover:bg-surface hover:text-foreground"
      >
        <Plus className="size-4" /> Add task
      </button>
    );
  }
  return (
    <form
      className="card-shadow rounded-xl border border-primary bg-surface p-2"
      onSubmit={(e) => {
        e.preventDefault();
        const name = value.trim();
        if (!name) return;
        setValue("");
        create({ groupId, name, statusId: column.statusId });
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => !value.trim() && setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Task name, then Enter"
        aria-label={`Add task to ${column.name}`}
        maxLength={500}
        className="w-full bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted"
      />
    </form>
  );
}
