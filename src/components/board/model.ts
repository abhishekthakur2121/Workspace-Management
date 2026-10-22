import type { BoardData, TaskRow } from "@/server/queries/board";

export type { BoardData, TaskRow };
export type Status = BoardData["statuses"][number];
export type Group = BoardData["groups"][number];
export type Tag = BoardData["tags"][number];
export type Person = BoardData["users"][number];
export type Priority = NonNullable<TaskRow["priority"]>;

// Priority labels, most urgent first. Colours read at a glance: red, orange,
// amber, blue (rendered as neon pills, see .neon-pill).
export const PRIORITIES: { value: Priority; label: string; color: string; rank: number }[] = [
  { value: "critical", label: "Critical", color: "#e2445c", rank: 4 },
  { value: "high", label: "High", color: "#ff7a1a", rank: 3 },
  { value: "medium", label: "Medium", color: "#f5b800", rank: 2 },
  { value: "low", label: "Low", color: "#579bfc", rank: 1 },
];
export const priorityMeta = (p: Priority | null) => PRIORITIES.find((x) => x.value === p);

export const COLUMNS = [
  { key: "accountable", label: "Accountable", width: 120 },
  { key: "responsible", label: "Responsible", width: 140 },
  { key: "status", label: "Status", width: 150 },
  { key: "due", label: "Due date", width: 120 },
  { key: "priority", label: "Priority", width: 130 },
  { key: "tags", label: "Tags", width: 170 },
] as const;
export type ColumnKey = (typeof COLUMNS)[number]["key"];

export type SortField = "name" | "status" | "due" | "priority";
export type Sort = { field: SortField; dir: "asc" | "desc" } | null;
export type GroupBy = "group" | "status";
export type DueFilter = "overdue" | "today" | "week" | "none";
export type Filters = { statusIds: string[]; priorities: Priority[]; tagIds: string[]; due: DueFilter | null };
export const EMPTY_FILTERS: Filters = { statusIds: [], priorities: [], tagIds: [], due: null };

export const NO_STATUS = "__none__";
