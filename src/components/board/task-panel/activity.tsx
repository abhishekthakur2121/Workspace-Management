import { ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { formatDue } from "@/lib/dates";
import { fullDate, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ThreadActivity } from "@/server/actions/comments";
import { PRIORITIES } from "../model";

// The task's change history, rendered from the snapshots in the Activity table.
export function ActivityLog({ items }: { items: ThreadActivity[] }) {
  if (!items.length) {
    return <p className="p-10 text-center text-sm text-muted">No changes recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-1 p-6 before:absolute before:top-8 before:bottom-8 before:left-[39px] before:w-px before:bg-grid">
      {items.map((a) => {
        // Actor is null once that person was permanently deleted.
        const name = a.actor ? (a.actor.name ?? a.actor.email) : "Deleted user";
        return (
          <li key={a.id} className="relative flex gap-3 py-2">
            <Avatar name={name} image={a.actor?.image} className={cn("relative size-8 shrink-0 text-xs ring-4 ring-background", !a.actor && "opacity-50 grayscale")} />
            <div className="min-w-0 flex-1 pt-1 text-sm">
              <span className="font-semibold">{name}</span> <Describe a={a} />
              <p className="mt-0.5 text-xs text-muted" title={fullDate(a.createdAt)}>
                {timeAgo(a.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  status: "Status",
  accountable: "Accountable",
  responsible: "Responsible",
  dueDate: "Due date",
  priority: "Priority",
  tags: "Tags",
  group: "Group",
};

function Describe({ a }: { a: ThreadActivity }) {
  switch (a.action) {
    case "created":
      return <span className="text-muted">created this task</span>;
    case "deleted":
      return <span className="text-muted">deleted this task</span>;
    case "restored":
      return <span className="text-muted">restored this task</span>;
    case "moved":
      return (
        <span className="text-muted">
          moved it <Change field="group" from={a.oldValue} to={a.newValue} />
        </span>
      );
    default:
      return (
        <span className="text-muted">
          changed <span className="font-medium text-foreground">{FIELD_LABELS[a.field ?? ""] ?? a.field}</span>{" "}
          <Change field={a.field ?? ""} from={a.oldValue} to={a.newValue} />
        </span>
      );
  }
}

function Change({ field, from, to }: { field: string; from: unknown; to: unknown }) {
  return (
    <span className="mt-1 inline-flex flex-wrap items-center gap-1.5 align-middle">
      <Value field={field} value={from} faded />
      <ArrowRight className="size-3.5 text-muted" />
      <Value field={field} value={to} />
    </span>
  );
}

// Renders a logged value the way it looks on the board.
function Value({ field, value, faded }: { field: string; value: unknown; faded?: boolean }) {
  const empty = <span className="rounded-md border border-dashed border-border px-1.5 py-0.5 text-xs text-muted">none</span>;
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) return empty;

  const chip = (text: string, color?: string) => (
    <span
      className={cn(
        "inline-block max-w-56 truncate rounded-full px-2.5 py-0.5 text-xs align-middle",
        color ? "neon-pill" : "bg-hover font-medium text-foreground",
        faded && "opacity-60",
      )}
      style={color ? ({ "--c": color } as React.CSSProperties) : undefined}
    >
      {text}
    </span>
  );

  if ((field === "status" || field === "group") && typeof value === "object" && value && "name" in value) {
    const v = value as { name: string; color?: string };
    return chip(v.name, field === "status" ? v.color : undefined);
  }
  if (field === "priority" && typeof value === "string") {
    const p = PRIORITIES.find((x) => x.value === value);
    return chip(p?.label ?? value, p?.color);
  }
  if (field === "dueDate" && typeof value === "string") return chip(formatDue(value));
  if (field === "accountable" && typeof value === "object" && value && "name" in value) return chip((value as { name: string }).name);
  if (Array.isArray(value)) return chip(value.map((v) => (field === "tags" ? `#${v}` : v)).join(", "));
  return chip(String(value));
}
