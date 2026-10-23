"use client";

import { startTransition, useEffect, useState } from "react";
import { Loader2, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getBoardSharing, setBoardAccess } from "@/server/actions/boards";
import { cn } from "@/lib/utils";
import { PeopleChecklist } from "./people-checklist";

type Sharing = Awaited<ReturnType<typeof getBoardSharing>>;

// Who can see (and so edit) a board: the whole workspace, or selected people.
export function BoardShareDialog({
  boardId,
  boardName,
  workspaceName,
  open,
  onOpenChange,
}: {
  boardId: string;
  boardName: string;
  workspaceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [sharing, setSharing] = useState<Sharing | null>(null);
  const [visibility, setVisibility] = useState<"workspace" | "private">("workspace");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    startTransition(async () => {
      try {
        const next = await getBoardSharing({ boardId });
        if (!alive) return;
        setSharing(next);
        setVisibility(next.visibility);
        setSelected(new Set(next.sharedWith));
      } catch {
        if (alive) toast.error("Couldn't load sharing settings.");
      }
    });
    return () => {
      alive = false;
    };
  }, [open, boardId]);

  // Workspace admins and the board's creator always have access.
  const locked: Record<string, string> = {};
  for (const m of sharing?.members ?? []) {
    if (m.role === "admin") locked[m.userId] = "Workspace admin";
    else if (m.userId === sharing?.createdById) locked[m.userId] = "Created this board";
  }

  function save() {
    setSaving(true);
    startTransition(async () => {
      try {
        const result = await setBoardAccess({ boardId, visibility, userIds: [...selected] });
        if ("error" in result) return void toast.error(result.error);
        toast.success(visibility === "workspace" ? `${boardName} is visible to everyone in ${workspaceName}.` : `${boardName} is shared with selected people.`);
        onOpenChange(false);
      } catch {
        toast.error("Couldn't save. Please try again.");
      } finally {
        setSaving(false);
      }
    });
  }

  const options = [
    { id: "workspace" as const, icon: <Users />, title: `Everyone in ${workspaceName}`, text: "All workspace members can see and edit this board." },
    { id: "private" as const, icon: <Lock />, title: "Only selected people", text: "Only the people you pick, plus workspace admins and the board's creator." },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={`Share ${boardName}`} description="Anyone who can see a board can edit its tasks." className="max-w-lg">
          {!sharing ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-4">
              <div role="radiogroup" aria-label="Who can see this board" className="grid gap-2">
                {options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={visibility === o.id}
                    onClick={() => setVisibility(o.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
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

              {visibility === "private" && (
                <PeopleChecklist
                  people={sharing.members.map((m) => ({ id: m.userId, ...m.user }))}
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
                  emptyText="This workspace has no other members"
                />
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />} Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
