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
  const [newRole, setNewRole] = useState<WorkspaceRole>("member");
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
          description="Only members see this workspace."
          className="max-w-xl"
        >
          {!data ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-5">
              <dl className="grid gap-1.5 rounded-xl bg-background/60 p-3 text-xs sm:grid-cols-3">
                {WORKSPACE_ROLES.map((r) => (
                  <div key={r.id}>
                    <dt className="font-semibold">{r.label}</dt>
                    <dd className="text-muted">{r.text}</dd>
                  </div>
                ))}
              </dl>
              <ul className="max-h-72 divide-y divide-grid overflow-y-auto rounded-xl border border-grid">
                {data.members.map((m) => {
                  const name = m.user.name ?? m.user.email;
                  return (
                    <li key={m.userId} className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5", !m.user.active && "opacity-60")}>
                      <Avatar name={name} image={m.user.image} className="size-8 text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        {m.user.name && <p className="truncate text-xs text-muted">{m.user.email}</p>}
                      </div>
                      <RolePicker
                        value={m.role}
                        disabled={busy}
                        label={`Role for ${name}`}
                        onChange={(r) => run(() => updateWorkspaceMember({ workspaceId, userId: m.userId, role: r }))}
                      />
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
                <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                  <span className="flex items-center gap-2 text-sm text-muted">
                    Add as <RolePicker value={newRole} onChange={setNewRole} label="Role for new members" />
                  </span>
                  <Button
                    disabled={!adding.size || busy}
                    onClick={() => {
                      const ids = [...adding];
                      setAdding(new Set());
                      run(() => addWorkspaceMembers({ workspaceId, userIds: ids, role: newRole }), `Added ${ids.length} ${ids.length === 1 ? "person" : "people"}.`);
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

type WorkspaceRole = "admin" | "editor" | "member";

export const WORKSPACE_ROLES: { id: WorkspaceRole; label: string; text: string }[] = [
  { id: "admin", label: "Admin", text: "Everything here, every board; manages members" },
  { id: "editor", label: "Editor", text: "Creates boards and manages their own" },
  { id: "member", label: "Member", text: "Works on tasks in boards shared with them" },
];

function RolePicker({
  value,
  onChange,
  disabled,
  label,
}: {
  value: WorkspaceRole;
  onChange: (r: WorkspaceRole) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-8 rounded-md border border-border p-0.5 text-xs">
      {WORKSPACE_ROLES.map((r) => (
        <button
          key={r.id}
          type="button"
          role="radio"
          aria-checked={value === r.id}
          title={r.text}
          disabled={disabled}
          onClick={() => value !== r.id && onChange(r.id)}
          className={cn(
            "inline-flex items-center gap-1 rounded px-2.5 transition-colors",
            value === r.id ? "bg-primary text-white" : "text-muted hover:text-foreground",
          )}
        >
          {r.id === "admin" && <Shield className="size-3" />}
          {r.label}
        </button>
      ))}
    </div>
  );
}
