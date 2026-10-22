"use client";

import { useBoard } from "../board-context";
import type { TaskRow } from "../model";

// Group progress shown in the group header: a short bar split by status
// colour, plus "2 of 5 done". Hover for the per-status breakdown.
export function GroupProgress({ tasks }: { tasks: TaskRow[] }) {
  const { board } = useBoard();
  const total = tasks.length;
  if (!total) return null;

  const parts = [
    ...board.statuses.map((s) => ({ key: s.id, name: s.name, color: s.color, n: tasks.filter((t) => t.statusId === s.id).length })),
    { key: "none", name: "No status", color: "#c4c4c4", n: tasks.filter((t) => !t.statusId).length },
  ].filter((p) => p.n > 0);
  const doneIds = new Set(board.statuses.filter((s) => s.isDone).map((s) => s.id));
  const done = tasks.filter((t) => t.statusId && doneIds.has(t.statusId)).length;
  const breakdown = parts.map((p) => `${p.name}: ${p.n}`).join(" · ");

  return (
    <span className="ml-1 hidden items-center gap-2 sm:inline-flex" title={breakdown} aria-label={`${done} of ${total} done. ${breakdown}`}>
      <span className="flex h-1.5 w-24 gap-px overflow-hidden rounded-full bg-label-empty">
        {parts.map((p) => (
          <span key={p.key} className="h-full transition-[width] duration-500" style={{ width: `${(p.n / total) * 100}%`, backgroundColor: p.color }} />
        ))}
      </span>
      <span className="text-xs whitespace-nowrap text-muted">
        {done} of {total} done
      </span>
    </span>
  );
}
