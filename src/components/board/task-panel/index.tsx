"use client";

import { startTransition, useEffect, useState } from "react";
import { Dialog as D } from "radix-ui";
import { History, Loader2, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadTaskThread, type TaskThread } from "@/server/actions/comments";
import { cn } from "@/lib/utils";
import { useBoard } from "../board-context";
import { DueCell, NameEditor, PeopleCell, PriorityCell, StatusCell, TagsCell } from "../cells";
import type { TaskRow } from "../model";
import { ActivityLog } from "./activity";
import { Updates } from "./updates";

type Tab = "updates" | "activity";

// Side panel for one task: its fields, the Updates thread and the change log.
export function TaskPanel() {
  const { tasks, board, openTaskId, closeTask } = useBoard();
  const task = openTaskId ? tasks.find((t) => t.id === openTaskId) : undefined;

  return (
    <D.Root open={!!openTaskId} onOpenChange={(o) => !o && closeTask()}>
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" />
        <D.Content
          aria-describedby={undefined}
          className="anim-sheet fixed inset-y-0 right-0 z-50 flex w-full max-w-[580px] flex-col border-l border-grid bg-surface shadow-2xl outline-none"
        >
          {task ? (
            <PanelBody key={task.id} task={task} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <D.Title className="font-semibold">{openTaskId && board ? "This task isn't on the board anymore" : "Task"}</D.Title>
              <p className="text-sm text-muted">It may have been deleted, or its group was removed.</p>
              <Button variant="secondary" onClick={closeTask}>
                Close
              </Button>
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function PanelBody({ task }: { task: TaskRow }) {
  const { board, tasks, closeTask, openTask } = useBoard();
  const [tab, setTab] = useState<Tab>("updates");
  const [thread, setThread] = useState<TaskThread | null>(null);
  const group = board.groups.find((g) => g.id === task.groupId);
  const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) : undefined;

  // Load the thread, and reload whenever the board changes (someone else commented).
  useEffect(() => {
    let alive = true;
    startTransition(async () => {
      try {
        const next = await loadTaskThread({ taskId: task.id });
        if (alive) setThread(next);
      } catch {
        if (alive) toast.error("Couldn't load updates for this task.");
      }
    });
    return () => {
      alive = false;
    };
  }, [task.id, board.version]);

  return (
    <>
      <header className="border-b border-grid px-6 pt-5 pb-4">
        <div className="flex items-center gap-2 text-xs text-muted">
          {group && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: group.color }} />
              {group.name}
            </span>
          )}
          {parent && (
            <>
              <span>/</span>
              <button onClick={() => openTask(parent.id)} className="truncate hover:text-foreground hover:underline">
                {parent.name}
              </button>
            </>
          )}
          <D.Close asChild>
            <button aria-label="Close task" className="ml-auto rounded-md p-1.5 transition hover:bg-hover hover:text-foreground">
              <X className="size-4" />
            </button>
          </D.Close>
        </div>
        <D.Title asChild>
          <div className="mt-1 flex text-xl font-semibold">
            <NameEditor task={task} className="-ml-2 text-xl font-semibold" />
          </div>
        </D.Title>

        <dl className="mt-4 grid grid-cols-[110px_1fr] overflow-clip rounded-xl border border-grid text-sm">
          {(
            [
              ["Status", <StatusCell key="s" task={task} />],
              ["Accountable", <PeopleCell key="a" task={task} field="accountable" />],
              ["Responsible", <PeopleCell key="r" task={task} field="responsible" />],
              ["Due date", <DueCell key="d" task={task} />],
              ["Priority", <PriorityCell key="p" task={task} />],
              ["Tags", <TagsCell key="t" task={task} />],
            ] as const
          ).map(([label, cell]) => (
            <div key={label} className="contents">
              <dt className="flex h-10 items-center border-b border-grid bg-background/50 px-3 text-xs font-medium text-muted [&:nth-last-child(2)]:border-b-0">
                {label}
              </dt>
              <dd className="h-10 border-b border-l border-grid [&:last-child]:border-b-0 [&>button]:justify-start">{cell}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div role="tablist" aria-label="Task details" className="flex gap-5 border-b border-grid px-6">
        <TabButton active={tab === "updates"} onClick={() => setTab("updates")} icon={<MessageSquare />}>
          Updates{thread?.comments.length ? ` (${thread.comments.length})` : ""}
        </TabButton>
        <TabButton active={tab === "activity"} onClick={() => setTab("activity")} icon={<History />}>
          Activity
        </TabButton>
      </div>

      <div className="flex-1 overflow-y-auto bg-background/40">
        {!thread ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : tab === "updates" ? (
          <Updates taskId={task.id} thread={thread} setThread={setThread} />
        ) : (
          <ActivityLog items={thread.activity} />
        )}
      </div>

      <footer className="flex justify-end border-t border-grid px-6 py-2 sm:hidden">
        <Button variant="ghost" size="sm" onClick={closeTask}>
          Close
        </Button>
      </footer>
    </>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 py-2.5 text-sm font-medium transition-colors [&>svg]:size-4",
        active ? "border-primary text-foreground [&>svg]:text-primary" : "border-transparent text-muted hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
