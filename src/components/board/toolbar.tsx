"use client";

import { ArrowDownUp, Check, ChevronDown, EyeOff, Filter, Layers, Loader2, Plus, UserCircle2 } from "lucide-react";
import { SearchField } from "@/components/ui/search-field";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useBoard } from "./board-context";
import { TagChip } from "./pickers";
import { COLUMNS, PRIORITIES, type ColumnKey, type DueFilter, type Filters, type GroupBy, type Sort, type SortField } from "./model";

export type ToolbarProps = {
  search: string;
  onSearch: (v: string) => void;
  personId: string | null;
  onPerson: (id: string | null) => void;
  filters: Filters;
  onFilters: (f: Filters) => void;
  sort: Sort;
  onSort: (s: Sort) => void;
  hidden: ColumnKey[];
  onHidden: (h: ColumnKey[]) => void;
  groupBy: GroupBy;
  onGroupBy: (g: GroupBy) => void;
  onNewTask: () => void;
  onNewGroup: () => void;
  view: "table" | "kanban";
};

const toolButton =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-foreground/80 transition-all duration-150 hover:bg-hover hover:text-foreground active:scale-[0.97] data-[state=open]:bg-hover [&>svg]:size-4 [&>svg]:text-muted";
const activeTool = "bg-selected text-primary hover:bg-selected";

export function Toolbar(p: ToolbarProps) {
  const { board, saving } = useBoard();
  const filterCount = p.filters.statusIds.length + p.filters.priorities.length + p.filters.tagIds.length + (p.filters.due ? 1 : 0);
  const person = board.users.find((u) => u.id === p.personId);

  return (
    // Pinned while the board scrolls, with a frosted background.
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-grid bg-surface/80 px-6 py-2.5 backdrop-blur-md supports-[backdrop-filter]:bg-surface/70">
      <div className="mr-2 flex">
        <button
          onClick={p.onNewTask}
          disabled={!board.groups.length}
          className="h-8 rounded-l-md bg-primary px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-primary/30 transition-all duration-150 hover:bg-primary-hover active:scale-[0.97] disabled:opacity-50"
        >
          New task
        </button>
        <Menu>
          <MenuTrigger asChild>
            <button aria-label="More create options" className="h-8 rounded-r-md border-l border-white/30 bg-primary px-1.5 text-white hover:bg-primary-hover">
              <ChevronDown className="size-4" />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<Plus />} onSelect={p.onNewGroup}>
              New group of tasks
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <SearchField
        value={p.search}
        onChange={p.onSearch}
        placeholder="Search tasks"
        label="Search tasks"
        className="mr-1"
        inputClassName="focus:w-44 sm:transition-all"
      />

      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(toolButton, person && activeTool)}>
            {person ? <Avatar name={person.name ?? person.email} image={person.image} className="size-5 text-[9px]" /> : <UserCircle2 />}
            Person
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <p className="mb-2 px-1 text-xs text-muted">Show tasks where this person is accountable or responsible</p>
          <div className="flex flex-wrap gap-1.5">
            {board.users
              .filter((u) => u.active)
              .map((u) => (
                <button
                  key={u.id}
                  title={u.name ?? u.email}
                  aria-pressed={u.id === p.personId}
                  onClick={() => p.onPerson(u.id === p.personId ? null : u.id)}
                  className={cn("rounded-full", u.id === p.personId ? "ring-2 ring-primary ring-offset-2" : "opacity-80 hover:opacity-100")}
                >
                  <Avatar name={u.name ?? u.email} image={u.image} className="size-8 text-xs" />
                </button>
              ))}
          </div>
          {person && (
            <button onClick={() => p.onPerson(null)} className="mt-3 text-xs text-primary hover:underline">
              Clear person filter
            </button>
          )}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(toolButton, filterCount && activeTool)}>
            <Filter />
            Filter{filterCount ? ` / ${filterCount}` : ""}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(36rem,calc(100vw-2rem))] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold">Filters</span>
            {filterCount > 0 && (
              <button onClick={() => p.onFilters({ statusIds: [], priorities: [], tagIds: [], due: null })} className="text-xs text-primary hover:underline">
                Clear all
              </button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FilterSection title="Status">
              {board.statuses.map((s) => (
                <Chip key={s.id} on={p.filters.statusIds.includes(s.id)} onClick={() => p.onFilters({ ...p.filters, statusIds: toggle(p.filters.statusIds, s.id) })}>
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </Chip>
              ))}
            </FilterSection>
            <FilterSection title="Priority">
              {PRIORITIES.map((pr) => (
                <Chip
                  key={pr.value}
                  on={p.filters.priorities.includes(pr.value)}
                  onClick={() => p.onFilters({ ...p.filters, priorities: toggle(p.filters.priorities, pr.value) })}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: pr.color }} />
                  {pr.label}
                </Chip>
              ))}
            </FilterSection>
            <FilterSection title="Due date">
              {(
                [
                  ["overdue", "Overdue"],
                  ["today", "Today"],
                  ["week", "Next 7 days"],
                  ["none", "No date"],
                ] as [DueFilter, string][]
              ).map(([v, label]) => (
                <Chip key={v} on={p.filters.due === v} onClick={() => p.onFilters({ ...p.filters, due: p.filters.due === v ? null : v })}>
                  {label}
                </Chip>
              ))}
            </FilterSection>
            <FilterSection title="Tags">
              {board.tags.length ? (
                board.tags.map((t) => (
                  <Chip key={t.id} on={p.filters.tagIds.includes(t.id)} onClick={() => p.onFilters({ ...p.filters, tagIds: toggle(p.filters.tagIds, t.id) })}>
                    <TagChip tag={t} />
                  </Chip>
                ))
              ) : (
                <span className="text-xs text-muted">No tags on this board yet</span>
              )}
            </FilterSection>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(toolButton, p.sort && activeTool)}>
            <ArrowDownUp />
            Sort
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60">
          <p className="mb-1 px-1 text-xs text-muted">
            {p.view === "kanban" ? "Sort cards in each column (turns off dragging to reorder)" : "Sort tasks within each group"}
          </p>
          {(
            [
              ["name", "Name", "A → Z", "Z → A"],
              ["due", "Due date", "Soonest first", "Latest first"],
              ["priority", "Priority", "Highest first", "Lowest first"],
              ["status", "Status", "Label order", "Reverse order"],
            ] as [SortField, string, string, string][]
          ).map(([field, label, asc, desc]) => (
            <div key={field} className="flex items-center gap-1 px-1 py-0.5">
              <span className="flex-1">{label}</span>
              {(["asc", "desc"] as const).map((dir) => {
                const on = p.sort?.field === field && p.sort.dir === dir;
                return (
                  <button
                    key={dir}
                    onClick={() => p.onSort(on ? null : { field, dir })}
                    className={cn("rounded px-1.5 py-0.5 text-xs", on ? "bg-primary text-white" : "text-muted hover:bg-hover")}
                  >
                    {dir === "asc" ? asc : desc}
                  </button>
                );
              })}
            </div>
          ))}
          {p.sort && (
            <button onClick={() => p.onSort(null)} className="mt-2 px-1 text-xs text-primary hover:underline">
              Remove sort
            </button>
          )}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(toolButton, p.hidden.length && activeTool)}>
            <EyeOff />
            Hide{p.hidden.length ? ` / ${p.hidden.length}` : ""}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-52">
          <p className="mb-1 px-1 text-xs text-muted">{p.view === "kanban" ? "Card fields" : "Columns"}</p>
          {COLUMNS.filter((c) => p.view === "table" || c.key !== "status").map((c) => {
            const visible = !p.hidden.includes(c.key);
            return (
              <button
                key={c.key}
                onClick={() => p.onHidden(toggle(p.hidden, c.key))}
                className="flex w-full items-center gap-2 rounded px-1.5 py-1.5 hover:bg-hover"
              >
                <span className={cn("grid size-4 place-items-center rounded border", visible ? "border-primary bg-primary text-white" : "border-border")}>
                  {visible && <Check className="size-3" />}
                </span>
                {c.label}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      {p.view === "table" && (
        <Menu>
          <MenuTrigger asChild>
            <button className={cn(toolButton, p.groupBy !== "group" && activeTool)}>
              <Layers />
              Group by{p.groupBy === "status" ? ": Status" : ""}
            </button>
          </MenuTrigger>
          <MenuContent>
            {(
              [
                ["group", "Groups"],
                ["status", "Status"],
              ] as [GroupBy, string][]
            ).map(([v, label]) => (
              <MenuItem key={v} onSelect={() => p.onGroupBy(v)} icon={p.groupBy === v ? <Check /> : <span />}>
                {label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      )}

      <span role="status" data-saving={saving} className="ml-auto flex items-center gap-1.5 text-xs text-muted">
        {saving ? (
          <>
            <Loader2 className="size-3.5 animate-spin" /> Saving…
          </>
        ) : null}
      </span>
    </div>
  );
}

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        on ? "border-primary bg-selected text-primary" : "border-border hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}
