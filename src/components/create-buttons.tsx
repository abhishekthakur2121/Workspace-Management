"use client";

import { startTransition, useEffect, useState } from "react";
import { Loader2, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PeopleChecklist, type PersonOption } from "@/components/access/people-checklist";
import { useRouter } from "next/navigation";
import { createBoard } from "@/server/actions/boards";
import { createWorkspace, listPeopleForNewWorkspace, listWorkspacePeople } from "@/server/actions/workspaces";

// Wrap any button: clicking it opens the "new board" dialog, then navigates there.
// Name plus who can see it: the whole workspace or only selected members
// (workspace admins and the creator always can).
export function CreateBoardDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"workspace" | "private">("workspace");
  const [people, setPeople] = useState<(PersonOption & { role: string })[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    startTransition(async () => {
      try {
        const list = await listWorkspacePeople({ workspaceId });
        if (alive) setPeople(list);
      } catch {
        if (alive) setPeople([]);
      }
    });
    return () => {
      alive = false;
    };
  }, [open, workspaceId]);

  function close() {
    setName("");
    setVisibility("workspace");
    setSelected(new Set());
    onOpenChange(false);
  }

  const locked: Record<string, string> = {};
  for (const p of people ?? []) if (p.role === "admin") locked[p.id] = "Workspace admin";

  const options = [
    { id: "workspace" as const, icon: <Users />, title: "Everyone in the workspace", text: "All workspace members can see and edit it." },
    { id: "private" as const, icon: <Lock />, title: "Only selected people", text: "You, workspace admins and the people you pick." },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      {open && (
        <DialogContent title="Create board" description={'A board holds one stream of work, like "Digital Operations".'} className="max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              setPending(true);
              startTransition(async () => {
                try {
                  const board = await createBoard({ workspaceId, name, visibility, userIds: [...selected] });
                  close();
                  router.push(`/b/${board.id}`);
                } catch {
                  toast.error("Couldn't create the board.");
                } finally {
                  setPending(false);
                }
              });
            }}
            className="space-y-4"
          >
            <label className="block text-sm font-medium">
              Board name
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Digital Operations"
                maxLength={80}
                className="mt-1.5 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <div>
              <p className="mb-2 text-sm font-medium">Who can see it?</p>
              <div role="radiogroup" aria-label="Who can see this board" className="grid gap-2 sm:grid-cols-2">
                {options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={visibility === o.id}
                    onClick={() => setVisibility(o.id)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                      visibility === o.id ? "border-primary bg-selected/40" : "border-grid hover:bg-hover/50",
                    )}
                  >
                    <span className={cn("mt-0.5 [&>svg]:size-4", visibility === o.id ? "text-primary" : "text-muted")}>{o.icon}</span>
                    <span>
                      <span className="block text-sm font-medium">{o.title}</span>
                      <span className="block text-xs text-muted">{o.text}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {visibility === "private" &&
              (people ? (
                <PeopleChecklist
                  people={people}
                  selected={selected}
                  locked={locked}
                  onToggle={(id, on) =>
                    setSelected((s) => {
                      const next = new Set(s);
                      if (on) next.add(id);
                      else next.delete(id);
                      return next;
                    })
                  }
                  emptyText="No other members in this workspace"
                />
              ) : (
                <div className="skeleton h-40 rounded-xl" />
              ))}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || pending}>
                {pending && <Loader2 className="size-4 animate-spin" />} Create board
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

// Name plus members: the creator becomes the workspace admin automatically.
export function CreateWorkspaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [people, setPeople] = useState<PersonOption[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    startTransition(async () => {
      try {
        const list = await listPeopleForNewWorkspace();
        if (alive) setPeople(list);
      } catch {
        if (alive) setPeople([]);
      }
    });
    return () => {
      alive = false;
    };
  }, [open]);

  function close() {
    setName("");
    setSelected(new Set());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      {open && (
        <DialogContent title="Create workspace" description="You'll be its admin. Only the people you add can see it." className="max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              setPending(true);
              startTransition(async () => {
                try {
                  const workspace = await createWorkspace({ name, memberIds: [...selected] });
                  close();
                  router.push(`/w/${workspace.id}`);
                } catch {
                  toast.error("Couldn't create the workspace.");
                } finally {
                  setPending(false);
                }
              });
            }}
            className="space-y-4"
          >
            <label className="block text-sm font-medium">
              Workspace name
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. NXT"
                maxLength={80}
                className="mt-1.5 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <div>
              <p className="mb-2 text-sm font-medium">
                Members <span className="font-normal text-muted">(you can change this later)</span>
              </p>
              {people ? (
                <PeopleChecklist
                  people={people}
                  selected={selected}
                  onToggle={(id, on) =>
                    setSelected((s) => {
                      const next = new Set(s);
                      if (on) next.add(id);
                      else next.delete(id);
                      return next;
                    })
                  }
                  emptyText="No one else on the team yet"
                />
              ) : (
                <div className="skeleton h-40 rounded-xl" />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || pending}>
                {pending && <Loader2 className="size-4 animate-spin" />} Create workspace
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function CreateBoardButton({ workspaceId, children }: { workspaceId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {children}
      </span>
      <CreateBoardDialog workspaceId={workspaceId} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function CreateWorkspaceButton({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {children}
      </span>
      <CreateWorkspaceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
