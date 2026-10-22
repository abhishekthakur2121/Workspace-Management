import { addDaysISO, todayISO } from "@/lib/dates";
import { NO_STATUS, priorityMeta, type DueFilter, type Filters, type Group, type GroupBy, type Sort, type Status, type TaskRow } from "./model";

export type Section = {
  id: string; // group id, or status id / NO_STATUS when grouped by status
  name: string;
  color: string;
  kind: "group" | "status";
  tasks: TaskRow[]; // visible top-level tasks, in display order
};

export function matchesDue(due: string | null, filter: DueFilter) {
  const today = todayISO();
  if (filter === "none") return !due;
  if (!due) return false;
  if (filter === "overdue") return due < today;
  if (filter === "today") return due === today;
  return due >= today && due <= addDaysISO(today, 7);
}

export function compareTasks(a: TaskRow, b: TaskRow, sort: NonNullable<Sort>, statuses: Status[]) {
  const dir = sort.dir === "asc" ? 1 : -1;
  const nullsLast = (x: unknown, y: unknown) => (x == null ? (y == null ? 0 : 1) : y == null ? -1 : null);
  switch (sort.field) {
    case "name":
      return dir * a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
    case "due": {
      const n = nullsLast(a.dueDate, b.dueDate);
      return n ?? dir * a.dueDate!.localeCompare(b.dueDate!);
    }
    case "priority": {
      const n = nullsLast(a.priority, b.priority);
      return n ?? dir * (priorityMeta(b.priority)!.rank - priorityMeta(a.priority)!.rank);
    }
    case "status": {
      const idx = (id: string | null) => (id ? statuses.findIndex((s) => s.id === id) : -1);
      const n = nullsLast(a.statusId, b.statusId);
      return n ?? dir * (idx(a.statusId) - idx(b.statusId));
    }
  }
}

export type BoardQuery = {
  search: string;
  personId: string | null;
  filters: Filters;
  sort: Sort;
  groupBy: GroupBy;
};

// Applies the toolbar to the board. A top-level task passes when it, or one
// of its subtasks, matches the search and person; the attribute filters
// (status, priority, tags, due) apply to the task itself.
export function queryBoard(tasks: TaskRow[], groups: Group[], statuses: Status[], q: BoardQuery) {
  const text = q.search.trim().toLowerCase();
  const textAndPerson = (t: TaskRow) =>
    (!text || t.name.toLowerCase().includes(text)) &&
    (!q.personId || t.accountableId === q.personId || t.responsibleIds.includes(q.personId));
  const { statusIds, priorities, tagIds, due } = q.filters;
  const attributes = (t: TaskRow) =>
    (!statusIds.length || (t.statusId !== null && statusIds.includes(t.statusId))) &&
    (!priorities.length || (t.priority !== null && priorities.includes(t.priority))) &&
    (!tagIds.length || t.tagIds.some((id) => tagIds.includes(id))) &&
    (!due || matchesDue(t.dueDate, due));

  const subtasksOf = new Map<string, TaskRow[]>();
  for (const t of tasks) if (t.parentId) subtasksOf.set(t.parentId, [...(subtasksOf.get(t.parentId) ?? []), t]);

  let top = tasks.filter((t) => !t.parentId && attributes(t) && (textAndPerson(t) || (subtasksOf.get(t.id) ?? []).some(textAndPerson)));
  if (q.sort) {
    const sort = q.sort;
    top = [...top].sort((a, b) => compareTasks(a, b, sort, statuses));
  }

  const sections: Section[] =
    q.groupBy === "group"
      ? groups.map((g) => ({ id: g.id, name: g.name, color: g.color, kind: "group", tasks: top.filter((t) => t.groupId === g.id) }))
      : [
          ...statuses.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: "status" as const, tasks: top.filter((t) => t.statusId === s.id) })),
          { id: NO_STATUS, name: "No status", color: "#9699a6", kind: "status" as const, tasks: top.filter((t) => !t.statusId) },
        ];

  const filtering = !!text || !!q.personId;
  return { top, sections, subtaskFilter: (t: TaskRow) => !filtering || textAndPerson(t) };
}
