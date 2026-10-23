"use client";

import { startTransition, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PeopleChecklist, type PersonOption } from "@/components/access/people-checklist";
import { useRouter } from "next/navigation";
import { NameDialog } from "@/components/dialogs";
import { createBoard } from "@/server/actions/boards";
import { createWorkspace, listPeopleForNewWorkspace } from "@/server/actions/workspaces";

// Wrap any button: clicking it opens the "new board" dialog, then navigates there.
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
  return (
    <NameDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create board"
      label="Board name"
      placeholder="e.g. Digital Operations"
      submitLabel="Create board"
      onSubmit={async (name) => {
        const board = await createBoard({ workspaceId, name });
        router.push(`/b/${board.id}`);
      }}
    />
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
