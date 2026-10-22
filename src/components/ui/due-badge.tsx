import { AlertCircle } from "lucide-react";
import { formatDue, isOverdue } from "@/lib/dates";
import { cn } from "@/lib/utils";

// A due date: red with an alert icon when overdue, struck through when done.
export function DueBadge({ due, done, className }: { due: string; done?: boolean; className?: string }) {
  const overdue = isOverdue(due, done);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px]",
        overdue && "bg-danger/10 font-medium text-danger",
        done && "text-muted line-through",
        className,
      )}
    >
      {overdue && <AlertCircle className="size-3.5" />}
      {formatDue(due)}
    </span>
  );
}
