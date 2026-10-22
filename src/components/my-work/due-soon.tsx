"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2 } from "lucide-react";
import { formatDue } from "@/lib/dates";
import { WorkspaceIcon } from "@/components/ui/avatar";
import type { MyTask } from "@/server/queries/my-work";
import { cn } from "@/lib/utils";
import { bucketize, isDone } from "./my-work-list";

// Home's "Due soon": overdue + next 7 days, not done. Bucketed on the client
// so "today" is the viewer's today.
export function DueSoon({ tasks }: { tasks: MyTask[] }) {
  const buckets = bucketize(tasks.filter((t) => !isDone(t)));
  const overdue = buckets.find((b) => b.id === "overdue")!.tasks;
  const soon = [...buckets.find((b) => b.id === "today")!.tasks, ...buckets.find((b) => b.id === "week")!.tasks];
  const shown = [...overdue, ...soon].slice(0, 8);
  const more = overdue.length + soon.length - shown.length;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <CalendarClock className="size-4 text-muted" /> Due soon
          {overdue.length > 0 && (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">{overdue.length} overdue</span>
          )}
        </h2>
        <Link href="/my-work" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          My work <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {shown.length === 0 ? (
        <div className="card-shadow flex items-center gap-3 rounded-xl border border-grid bg-surface p-4 text-sm text-muted">
          <CheckCircle2 className="size-5 text-[#00c875]" /> Nothing overdue or due this week.
        </div>
      ) : (
        <ul className="card-shadow divide-y divide-grid overflow-clip rounded-xl border border-grid bg-surface">
          {shown.map((t) => {
            const late = overdue.includes(t);
            return (
              <li key={t.id}>
                <Link href={`/b/${t.board.id}?task=${t.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-background/60">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                  <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
                    <WorkspaceIcon name={t.board.workspace.name} color={t.board.workspace.color} className="size-4 text-[9px]" />
                    <span className="max-w-40 truncate">{t.board.name}</span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                      late ? "bg-danger/10 font-medium text-danger" : "bg-hover text-muted",
                    )}
                  >
                    {late && <AlertCircle className="size-3" />}
                    {formatDue(t.dueDate!)}
                  </span>
                </Link>
              </li>
            );
          })}
          {more > 0 && (
            <li>
              <Link href="/my-work" className="block px-4 py-2 text-center text-xs text-primary hover:underline">
                {more} more in My work
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
