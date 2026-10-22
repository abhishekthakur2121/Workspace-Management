"use client";

import { startTransition, useOptimistic, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, ChevronDown, CornerDownRight, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { PopoverTrigger } from "@/components/ui/popover";
import { DatePicker, PriorityPicker, StatusPicker } from "@/components/board/pickers";
import { priorityMeta } from "@/components/board/model";
import { addDaysISO, todayISO } from "@/lib/dates";
import { DueBadge } from "@/components/ui/due-badge";
import { LabelPill } from "@/components/ui/label-pill";
import { SearchField } from "@/components/ui/search-field";
import { WorkspaceIcon } from "@/components/ui/avatar";
import { usePersistentState } from "@/lib/use-persistent-state";
import { updateTask, type TaskPatch } from "@/server/actions/tasks";
import type { MyTask } from "@/server/queries/my-work";
import { cn } from "@/lib/utils";

type Bucket = { id: string; title: string; tone?: "danger"; tasks: MyTask[] };

// Dates are bucketed in the viewer's own timezone.
export function bucketize(tasks: MyTask[]): Bucket[] {
  const today = todayISO();
  const week = addDaysISO(today, 7);
  const buckets: Bucket[] = [
    { id: "overdue", title: "Overdue", tone: "danger", tasks: [] },
    { id: "today", title: "Today", tasks: [] },
    { id: "week", title: "Next 7 days", tasks: [] },
    { id: "later", title: "Later", tasks: [] },
    { id: "none", title: "No due date", tasks: [] },
  ];
  const by = Object.fromEntries(buckets.map((b) => [b.id, b]));
  for (const t of tasks) {
    const d = t.dueDate;
    const key = !d ? "none" : d < today ? "overdue" : d === today ? "today" : d <= week ? "week" : "later";
    by[key].tasks.push(t);
  }
  return buckets;
}

export const isDone = (t: MyTask) => !!t.board.statuses.find((s) => s.id === t.statusId)?.isDone;

export function MyWorkList({ tasks: initial }: { tasks: MyTask[] }) {
  const router = useRouter();
  const [tasks, applyOptimistic] = useOptimistic(initial, (state: MyTask[], edit: { id: string; patch: TaskPatch }) =>
    state.map((t) => (t.id === edit.id ? ({ ...t, ...edit.patch } as MyTask) : t)),
  );
  const [showDone, setShowDone] = usePersistentState("wm:mywork:showDone", false);
  const [collapsed, setCollapsed] = usePersistentState<string[]>("wm:mywork:collapsed", NONE);
  const [query, setQuery] = useState("");

  function update(id: string, patch: TaskPatch) {
    startTransition(async () => {
      applyOptimistic({ id, patch });
      try {
        await updateTask({ id, patch });
      } catch {
        toast.error("Couldn't save that change. The list was reloaded.");
        router.refresh();
      }
    });
  }

  const q = query.trim().toLowerCase();
  const visible = tasks.filter(
    (t) => (showDone || !isDone(t)) && (!q || t.name.toLowerCase().includes(q) || t.board.name.toLowerCase().includes(q)),
  );
  const doneCount = tasks.filter(isDone).length;
  const buckets = bucketize(visible).filter((b) => b.tasks.length > 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="Search my tasks" label="Search my tasks" inputClassName="w-44" />
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="size-4 accent-primary" />
          Show done{doneCount ? ` (${doneCount})` : ""}
        </label>
      </div>

      {buckets.length === 0 ? (
        <div className="card-shadow grid place-items-center rounded-xl border border-grid bg-surface px-6 py-14 text-center">
          <PartyPopper className="size-8 text-primary" />
          <p className="mt-3 font-medium">{q ? "No tasks match your search" : "You're all caught up"}</p>
          <p className="mt-1 text-sm text-muted">
            {q ? "Try another word." : "Tasks where you're accountable or responsible will show up here."}
          </p>
        </div>
      ) : (
        buckets.map((b) => {
          const isCollapsed = collapsed.includes(b.id);
          return (
            <section key={b.id} aria-label={b.title}>
              <button
                onClick={() => setCollapsed((c) => (c.includes(b.id) ? c.filter((x) => x !== b.id) : [...c, b.id]))}
                aria-expanded={!isCollapsed}
                className="mb-2 flex items-center gap-1.5"
              >
                <ChevronDown className={cn("size-5 text-muted transition-transform", isCollapsed && "-rotate-90")} />
                <h2 className={cn("text-[17px] font-semibold", b.tone === "danger" && "text-danger")}>{b.title}</h2>
                <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium text-muted">{b.tasks.length}</span>
              </button>
              {!isCollapsed && (
                <div className="card-shadow overflow-clip rounded-xl border border-grid bg-surface">
                  <div className="hidden h-9 grid-cols-[minmax(240px,1fr)_200px_110px_150px_120px_130px] border-b border-grid text-xs font-medium text-muted md:grid">
                    <div className="flex items-center px-4">Task</div>
                    <div className="flex items-center px-3">Board</div>
                    <div className="grid place-items-center">My role</div>
                    <div className="grid place-items-center">Status</div>
                    <div className="grid place-items-center">Due date</div>
                    <div className="grid place-items-center">Priority</div>
                  </div>
                  {b.tasks.map((t) => (
                    <TaskLine key={t.id} task={t} onUpdate={(patch) => update(t.id, patch)} />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

const NONE: string[] = [];

function TaskLine({ task, onUpdate }: { task: MyTask; onUpdate: (patch: TaskPatch) => void }) {
  const status = task.board.statuses.find((s) => s.id === task.statusId);
  const priority = priorityMeta(task.priority);
  const cell = "group/cell flex h-full w-full items-center justify-center px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary";

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-y-1 border-b border-grid py-2 last:border-b-0 hover:bg-background/60 md:h-11 md:grid-cols-[minmax(240px,1fr)_200px_110px_150px_120px_130px] md:py-0">
      <div className="min-w-0 px-4">
        <Link href={`/b/${task.board.id}?task=${task.id}`} className="block truncate text-sm font-medium hover:text-primary hover:underline">
          {task.name}
        </Link>
        {task.parentName && (
          <span className="flex items-center gap-1 truncate text-xs text-muted">
            <CornerDownRight className="size-3 shrink-0" /> Subtask of {task.parentName}
          </span>
        )}
      </div>
      <Link href={`/b/${task.board.id}`} className="flex min-w-0 items-center gap-2 px-3 text-sm text-muted hover:text-foreground">
        <WorkspaceIcon name={task.board.workspace.name} color={task.board.workspace.color} className="size-5 text-[10px]" />
        <span className="truncate">{task.board.name}</span>
      </Link>
      <div className="hidden place-items-center md:grid">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            task.role === "accountable" ? "bg-primary/10 text-primary" : "bg-hover text-muted",
          )}
        >
          {task.role === "accountable" ? "Accountable" : "Responsible"}
        </span>
      </div>
      <div className="col-span-2 grid h-10 grid-cols-3 md:contents">
        <StatusPicker boardId={task.board.id} statuses={task.board.statuses} value={task.statusId} onChange={(statusId) => onUpdate({ statusId })}>
          <PopoverTrigger asChild>
            <button className={cell} aria-label={`Status: ${status?.name ?? "none"}`}>
              <LabelPill color={status?.color} placeholder="Set status">
                {status?.name}
              </LabelPill>
            </button>
          </PopoverTrigger>
        </StatusPicker>
        <DatePicker value={task.dueDate} onChange={(dueDate) => onUpdate({ dueDate })}>
          <PopoverTrigger asChild>
            <button className={cn(cell, "hover:bg-hover/60")} aria-label={`Due date: ${task.dueDate ?? "none"}`}>
              {task.dueDate ? (
                <DueBadge due={task.dueDate} done={status?.isDone} />
              ) : (
                <CalendarPlus className="size-4 text-muted/40 group-hover/cell:text-primary" />
              )}
            </button>
          </PopoverTrigger>
        </DatePicker>
        <PriorityPicker value={task.priority} onChange={(p) => onUpdate({ priority: p })}>
          <PopoverTrigger asChild>
            <button className={cell} aria-label={`Priority: ${priority?.label ?? "none"}`}>
              <LabelPill color={priority?.color}>{priority?.label}</LabelPill>
            </button>
          </PopoverTrigger>
        </PriorityPicker>
      </div>
    </div>
  );
}
