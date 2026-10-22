"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Kanban, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePersistentState } from "@/lib/use-persistent-state";
import { createGroup } from "@/server/actions/board-structure";
import { BoardProvider, useBoard } from "./board-context";
import { BoardTable } from "./table";
import { Toolbar } from "./toolbar";
import { BulkBar } from "./bulk-bar";
import { KanbanBoard } from "./kanban";
import { TaskPanel } from "./task-panel";
import { COLUMNS, EMPTY_FILTERS, type BoardData, type ColumnKey, type Filters, type GroupBy, type Sort } from "./model";
import { queryBoard } from "./filtering";

export type BoardViewKind = "table" | "kanban";

export function BoardView({
  board,
  currentUserId,
  isAdmin,
}: {
  board: BoardData;
  currentUserId: string;
  isAdmin: boolean;
}) {
  // Both views render the same live board data, so switching is instant and
  // never shows a stale copy: the tab only changes ?view= in the URL.
  const view: BoardViewKind = useSearchParams().get("view") === "kanban" ? "kanban" : "table";
  return (
    <BoardProvider board={board} currentUserId={currentUserId} isAdmin={isAdmin}>
      <ViewTabs view={view} />
      <BoardScreen view={view} />
    </BoardProvider>
  );
}

function ViewTabs({ view }: { view: BoardViewKind }) {
  const tabs = [
    { id: "table", label: "Table", icon: <Table2 /> },
    { id: "kanban", label: "Kanban", icon: <Kanban /> },
  ] as const;
  return (
    <nav className="flex gap-4 border-b border-grid bg-surface px-6" aria-label="Board views">
      {tabs.map((t) => {
        const params = new URLSearchParams();
        if (t.id === "kanban") params.set("view", "kanban");
        const href = params.size ? `?${params}` : "?";
        return (
          <a
            key={t.id}
            href={href}
            aria-current={view === t.id ? "page" : undefined}
            onClick={(e) => {
              // Plain clicks switch in place; modifier clicks open a new tab as usual.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              const next = new URLSearchParams(window.location.search);
              next.delete("task");
              if (t.id === "kanban") next.set("view", "kanban");
              else next.delete("view");
              const query = next.toString();
              window.history.pushState(null, "", query ? `?${query}` : window.location.pathname);
            }}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-1 py-2.5 text-sm font-medium transition-colors [&>svg]:size-4",
              view === t.id ? "border-primary text-foreground [&>svg]:text-primary" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}

const NO_HIDDEN: ColumnKey[] = [];
const NO_COLLAPSED: string[] = [];

// Shared by both views: one toolbar, one set of filters; the table groups the
// result into sections, the Kanban board into status columns.
function BoardScreen({ view }: { view: BoardViewKind }) {
  const { board, tasks, create, setAutoEditId } = useBoard();
  const key = (name: string) => `wm:board:${board.id}:${name}`;

  const [search, setSearch] = useState("");
  const [personId, setPersonId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = usePersistentState<Sort>(key("sort"), null);
  const [hidden, setHidden] = usePersistentState<ColumnKey[]>(key("hidden"), NO_HIDDEN);
  const [groupBy, setGroupBy] = usePersistentState<GroupBy>(key("groupBy"), "group");
  const [collapsed, setCollapsed] = usePersistentState<string[]>(key("collapsed"), NO_COLLAPSED);
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const columns = COLUMNS.map((c) => c.key).filter((k) => !hidden.includes(k));

  const { top, sections, subtaskFilter } = useMemo(
    () => queryBoard(tasks, board.groups, board.statuses, { search, personId, filters, sort, groupBy }),
    [tasks, board.groups, board.statuses, search, personId, filters, sort, groupBy],
  );

  const visibleIds = new Set(tasks.map((t) => t.id));
  const selected = [...selection].filter((id) => visibleIds.has(id));
  const anyFilter = !!search.trim() || !!personId || filters !== EMPTY_FILTERS;

  return (
    <>
      <Toolbar
        search={search}
        onSearch={setSearch}
        personId={personId}
        onPerson={setPersonId}
        filters={filters}
        onFilters={setFilters}
        sort={sort}
        onSort={setSort}
        hidden={hidden}
        onHidden={setHidden}
        groupBy={groupBy}
        onGroupBy={setGroupBy}
        view={view}
        onNewTask={async () => {
          const groupId = board.groups[0]?.id;
          if (!groupId) return;
          setCollapsed((c) => c.filter((id) => id !== groupId));
          const id = await create({ groupId, name: "New task", at: "top" });
          if (id) setAutoEditId(id);
        }}
        onNewGroup={() => createGroup({ boardId: board.id })}
      />

      {board.groups.length === 0 ? (
        <div className="p-10 text-center">
          <p className="font-medium">This board has no groups</p>
          <button onClick={() => createGroup({ boardId: board.id })} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover">
            Add a group
          </button>
        </div>
      ) : view === "kanban" ? (
        <>
          {anyFilter && top.length === 0 && <p className="px-6 pt-6 text-sm text-muted">No tasks match your search or filters.</p>}
          <KanbanBoard cards={top} hidden={hidden} sort={sort} />
        </>
      ) : (
        <>
          {anyFilter && sections.every((s) => s.tasks.length === 0) && (
            <p className="px-6 pt-6 text-sm text-muted">No tasks match your search or filters.</p>
          )}
          <BoardTable
            sections={sections}
            columns={columns}
            collapsed={collapsed}
            onToggleCollapsed={(id) => setCollapsed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))}
            selected={new Set(selected)}
            onSelect={(ids, on) =>
              setSelection((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
                return next;
              })
            }
            canDrag={groupBy === "group" && !sort}
            subtaskFilter={subtaskFilter}
          />
        </>
      )}

      {view === "table" && <BulkBar ids={selected} onClear={() => setSelection(new Set())} />}
      <TaskPanel />
    </>
  );
}
