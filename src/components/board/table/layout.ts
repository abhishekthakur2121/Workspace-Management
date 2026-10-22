import { COLUMNS, type ColumnKey, type TaskRow } from "../model";
import type { Section } from "../filtering";

export type TableProps = {
  sections: Section[];
  columns: ColumnKey[];
  collapsed: string[];
  onToggleCollapsed: (id: string) => void;
  selected: Set<string>;
  onSelect: (ids: string[], on: boolean) => void;
  canDrag: boolean;
  subtaskFilter: (t: TaskRow) => boolean;
};

export type { Section };

export const NAME_MIN = 300;
export const CHECK_W = 40;

export function gridTemplate(columns: ColumnKey[]) {
  const widths = columns.map((k) => `${COLUMNS.find((c) => c.key === k)!.width}px`);
  return `${CHECK_W}px minmax(${NAME_MIN}px, 1fr) ${widths.join(" ")}`;
}

export function tableMinWidth(columns: ColumnKey[]) {
  return CHECK_W + NAME_MIN + columns.reduce((sum, k) => sum + COLUMNS.find((c) => c.key === k)!.width, 0) + 8;
}

export type { TaskRow };
