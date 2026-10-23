"use client";

import { startTransition, useEffect, useState } from "react";
import { Loader2, Shield, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  addWorkspaceMembers,
  getWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMember,
} from "@/server/actions/workspaces";
import { cn } from "@/lib/utils";
import { PeopleChecklist } from "./people-checklist";

type Data = Awaited<ReturnType<typeof getWorkspaceMembers>>;
type Result = { ok: true } | { error: string };

// Workspace admins manage who is in the workspace, who else is an admin and
// who may create boards.
export function WorkspaceMembersDialog({
  workspaceId,
  workspaceName,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  workspaceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    startTransition(async () => {
      try {
        const next = await getWorkspaceMembers({ workspaceId });
        if (alive) setData(next);
      } catch {
        if (alive) toast.error("Couldn't load members.");
      }
    });
    return () => {
      alive = false;
    };
  }, [open, workspaceId, version]);

  function run(action: () => Promise<Result>, success?: string) {
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await action();
        if ("error" in result) toast.error(result.error);
        else if (success) toast.success(success);
      } catch {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setBusy(false);
        setVersion((v) => v + 1);
      }
    });
  }

  const memberIds = new Set(data?.members.map((m) => m.userId));
  const candidates = data?.people.filter((p) => !memberIds.has(p.id)) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setAdding(new Set());
        onOpenChange(o);
      }}
    >
      {open && (
        <DialogContent
          title={`Members of ${workspaceName}`}
          description="Only members see this workspace. Admins can do everything in it, including on every board."
          className="max-w-xl"
        >
          {!data ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-5">
              <ul className="max-h-72 divide-y divide-grid overflow-y-auto rounded-xl border border-grid">
                {data.members.map((m) => {
                  const isAdmin = m.role === "admin";
                  const name = m.user.name ?? m.user.email;
                  return (
                    <li key={m.userId} className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5", !m.user.active && "opacity-60")}>
                      <Avatar name={name} image={m.user.image} className="size-8 text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        {m.user.name && <p className="truncate text-xs text-muted">{m.user.email}</p>}
                      </div>
                      <div role="radiogroup" aria-label={`Role for ${name}`} className="flex h-8 rounded-md border border-border p-0.5 text-xs">
                        {(["member", "admin"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            role="radio"
                            aria-checked={m.role === r}
                            disabled={busy}
                            onClick={() => m.role !== r && run(() => updateWorkspaceMember({ workspaceId, userId: m.userId, role: r }))}
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-2.5 capitalize transition-colors",
                              m.role === r ? "bg-primary text-white" : "text-muted hover:text-foreground",
                            )}
                          >
                            {r === "admin" && <Shield className="size-3" />}
                            {r}
                          </button>
                        ))}
                      </div>
                      <label
                        className={cn("inline-flex items-center gap-2 text-xs", isAdmin ? "text-muted" : "cursor-pointer")}
                        title={isAdmin ? "Admins can always create boards" : undefined}
                      >
                        <Switch
                          checked={isAdmin || m.canCreateBoards}
                          disabled={isAdmin || busy}
                          onChange={(on) => run(() => updateWorkspaceMember({ workspaceId, userId: m.userId, canCreateBoards: on }))}
                          label={`${name} can create boards`}
                        />
                        Can create boards
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove ${name} from ${workspaceName}`}
                        disabled={busy}
                        onClick={() => run(() => removeWorkspaceMember({ workspaceId, userId: m.userId }), `${name} was removed from ${workspaceName}.`)}
                        className="rounded-md p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div>
                <p className="mb-2 text-sm font-medium">Add people</p>
                <PeopleChecklist
                  people={candidates}
                  selected={adding}
                  onToggle={(id, on) =>
                    setAdding((s) => {
                      const next = new Set(s);
                      if (on) next.add(id);
                      else next.delete(id);
                      return next;
                    })
                  }
                  emptyText="Everyone is already a member"
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    disabled={!adding.size || busy}
                    onClick={() => {
                      const ids = [...adding];
                      setAdding(new Set());
                      run(() => addWorkspaceMembers({ workspaceId, userIds: ids }), `Added ${ids.length} ${ids.length === 1 ? "person" : "people"}.`);
                    }}
                  >
                    <UserPlus className="size-4" /> Add {adding.size || ""}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span className={cn("inline-block size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4.5" : "translate-x-0.5")} />
    </button>
  );
}
