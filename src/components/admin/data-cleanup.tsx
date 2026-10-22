"use client";

import { startTransition, useState } from "react";
import { Loader2, Lock, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { emptyTrash, resetAllWork } from "@/server/actions/cleanup";
import { cn } from "@/lib/utils";

type Action = {
  id: "trash" | "reset";
  title: string;
  description: string;
  confirm: string;
  button: string;
  icon: React.ReactNode;
  run: typeof emptyTrash;
};

const ACTIONS: Action[] = [
  {
    id: "trash",
    title: "Empty trash",
    description: "Permanently remove everything that has been deleted (normally kept for 30 days). Live work is not touched.",
    confirm: "Deleted workspaces, boards, groups, tasks and comments will be removed for good. They can no longer be restored.",
    button: "Empty trash",
    icon: <Trash2 />,
    run: emptyTrash,
  },
  {
    id: "reset",
    title: "Reset all work data",
    description: "Permanently remove every workspace, board, task, comment and change history. The team list and sign-ins are kept.",
    confirm: "Every workspace and everything in it will be deleted for everyone. This cannot be undone.",
    button: "Delete all work",
    icon: <RotateCcw />,
    run: resetAllWork,
  },
];

// Owner-only permanent clean-up (see src/server/actions/cleanup.ts).
export function DataCleanup({ canClean }: { canClean: boolean }) {
  const [open, setOpen] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);

  function run(action: Action) {
    setPending(true);
    startTransition(async () => {
      try {
        const result = await action.run();
        if ("error" in result) toast.error(result.error);
        else toast.success(`${action.title}: ${result.summary}`);
      } catch {
        toast.error("Something went wrong. Nothing may have been removed; please try again.");
      } finally {
        setPending(false);
        setOpen(null);
      }
    });
  }

  return (
    <section className="card-shadow overflow-clip rounded-xl border border-danger/30 bg-surface" aria-labelledby="cleanup-title">
      <div className="flex items-center gap-2 border-b border-danger/20 bg-danger/5 px-4 py-3">
        <h2 id="cleanup-title" className="font-semibold text-danger">
          Data clean-up
        </h2>
        {!canClean && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted">
            <Lock className="size-3.5" /> Owners only
          </span>
        )}
      </div>
      <ul className="divide-y divide-grid">
        {ACTIONS.map((a) => (
          <li key={a.id} className={cn("flex flex-wrap items-center gap-4 px-4 py-4", !canClean && "opacity-60")}>
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger [&>svg]:size-5">{a.icon}</span>
            <div className="min-w-56 flex-1">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-muted">{a.description}</p>
            </div>
            <Button variant="danger" size="sm" disabled={!canClean} onClick={() => setOpen(a)}>
              {a.button}
            </Button>
          </li>
        ))}
      </ul>
      {!canClean && (
        <p className="border-t border-grid px-4 py-2.5 text-xs text-muted">
          Only owners (the accounts listed in INITIAL_ADMIN_EMAILS) can permanently delete data.
        </p>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && !pending && setOpen(null)}>
        {open && (
          <DialogContent title="Are you sure?" description={open.confirm}>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(null)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => run(open)} disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />} {open.button}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
