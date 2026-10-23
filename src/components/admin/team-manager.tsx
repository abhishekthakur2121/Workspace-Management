"use client";

import { startTransition, useState } from "react";
import {
  Check,
  ChevronDown,
  KeyRound,
  MoreHorizontal,
  Shield,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  MIN_PASSWORD_LENGTH,
  PasswordChoiceField,
  PasswordRevealDialog,
  type PasswordMode,
} from "./password-ui";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { SearchField } from "@/components/ui/search-field";
import {
  addUser,
  deactivateUser,
  deleteUserPermanently,
  reactivateUser,
  resetPassword,
  setRole,
} from "@/server/actions/users";
import type { TeamMember } from "@/server/queries/users";
import { fullDate, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

type Role = TeamMember["role"];
type Result = { ok: true } | { error: string };

// Runs an admin action and reports the outcome as a toast.
function act(
  action: () => Promise<Result>,
  success: string,
  done?: () => void,
) {
  startTransition(async () => {
    try {
      const result = await action();
      if ("error" in result) toast.error(result.error);
      else {
        toast.success(success);
        done?.();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  });
}

export function TeamManager({
  team,
  currentUserId,
}: {
  team: TeamMember[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = team.filter(
    (u) =>
      !q || u.email.includes(q) || (u.name ?? "").toLowerCase().includes(q),
  );
  const active = team.filter((u) => u.active);
  const admins = active.filter((u) => u.role === "admin").length;

  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={<Users />} label="Active people" value={active.length} />
        <Stat icon={<Shield />} label="Admins" value={admins} />
        <Stat
          icon={<UserPlus />}
          label="Invited, not signed in yet"
          value={active.filter((u) => !u.hasSignedIn).length}
        />
      </div>

      <AddPerson />

      <section className="card-shadow overflow-clip rounded-xl border border-grid bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-grid px-4 py-3">
          <h2 className="font-semibold">Team</h2>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search people"
            label="Search people"
            inputClassName="w-40"
          />
        </div>
        <ul className="divide-y divide-grid">
          {visible.map((u) => (
            <MemberRow key={u.id} member={u} isMe={u.id === currentUserId} />
          ))}
          {visible.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted">
              No one matches &quot;{query}&quot;.
            </li>
          )}
        </ul>
      </section>

      <p className="text-xs text-muted">
        People sign in with the Google account for their email, or with a
        password if you set one. Forgotten passwords are reset here. Removing
        someone signs them out immediately; their tasks and comments stay, shown
        as greyed out.
      </p>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="card-shadow flex items-center gap-3 rounded-xl border border-grid bg-surface p-4">
      <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary [&>svg]:size-5">
        {icon}
      </span>
      <div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  );
}

function AddPerson() {
  const [email, setEmail] = useState("");
  const [role, setNewRole] = useState<Role>("member");
  const [mode, setMode] = useState<PasswordMode>("none");
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [reveal, setReveal] = useState<{
    email: string;
    password: string;
  } | null>(null);

  function submit() {
    const address = email.trim().toLowerCase();
    if (!address) return;
    if (mode === "typed" && typed.length < MIN_PASSWORD_LENGTH) {
      toast.error(
        `The password needs at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    setPending(true);
    startTransition(async () => {
      try {
        const result = await addUser({
          email,
          role,
          password:
            mode === "none"
              ? "none"
              : mode === "generate"
                ? "generate"
                : { typed },
        });
        if ("error" in result) return void toast.error(result.error);
        toast.success(
          mode === "none"
            ? `Added ${address}. They can sign in with Google.`
            : `Added ${address} with a temporary password.`,
        );
        if (result.password)
          setReveal({ email: address, password: result.password });
        setEmail("");
        setTyped("");
      } catch {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <>
      <form
        className="card-shadow flex flex-wrap items-end gap-x-4 gap-y-3 rounded-xl border border-grid bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="min-w-64 flex-1 text-sm font-medium">
          Add a person
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            autoComplete="off"
            className="mt-1.5 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <div className="text-sm font-medium">
          Role
          <div
            role="radiogroup"
            aria-label="Role"
            className="mt-1.5 flex h-9 rounded-md border border-border p-0.5"
          >
            {(["member", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => setNewRole(r)}
                className={cn(
                  "rounded px-3 text-sm font-normal capitalize transition-colors",
                  role === r
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={pending || !email.trim()}>
          <UserPlus className="size-4" /> Add
        </Button>
        <div className="basis-full">
          <PasswordChoiceField
            mode={mode}
            onMode={setMode}
            typed={typed}
            onTyped={setTyped}
          />
        </div>
      </form>
      <PasswordRevealDialog reveal={reveal} onClose={() => setReveal(null)} />
    </>
  );
}

// Admin sets a new temporary password (typed or generated) for someone who forgot theirs.
function ResetPasswordDialog({
  member,
  open,
  onOpenChange,
}: {
  member: TeamMember;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [mode, setMode] = useState<PasswordMode>("generate");
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [reveal, setReveal] = useState<{
    email: string;
    password: string;
  } | null>(null);

  function submit() {
    if (mode === "typed" && typed.length < MIN_PASSWORD_LENGTH) {
      toast.error(
        `The password needs at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    setPending(true);
    startTransition(async () => {
      try {
        const result = await resetPassword({
          id: member.id,
          password: mode === "typed" ? { typed } : "generate",
        });
        if ("error" in result) return void toast.error(result.error);
        onOpenChange(false);
        setTyped("");
        if (result.password)
          setReveal({ email: member.email, password: result.password });
      } catch {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
        {open && (
          <DialogContent
            title="Reset password"
            description={
              <>
                {member.name ?? member.email} will be signed out everywhere and
                must choose a new password after signing in with the temporary
                one.
              </>
            }
          >
            <PasswordChoiceField
              mode={mode}
              onMode={setMode}
              typed={typed}
              onTyped={setTyped}
              allowNone={false}
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={pending}>
                <KeyRound className="size-4" /> Reset password
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
      <PasswordRevealDialog reveal={reveal} onClose={() => setReveal(null)} />
    </>
  );
}

function MemberRow({ member: u, isMe }: { member: TeamMember; isMe: boolean }) {
  const name = u.name ?? u.email;
  const status = !u.active
    ? "Deactivated"
    : u.hasSignedIn
      ? "Active"
      : "Invited";
  const statusColor = {
    Active: "#00c875",
    Invited: "#579bfc",
    Deactivated: "#9699a6",
  }[status];

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 px-4 py-3",
        !u.active && "bg-background/40",
      )}
    >
      <Avatar
        name={name}
        image={u.image}
        className={cn("size-9 text-xs", !u.active && "opacity-50 grayscale")}
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          {u.name ?? <span className="text-muted">No name yet</span>}
          {isMe && (
            <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] text-muted">
              You
            </span>
          )}
          {u.hasPassword && (
            <span
              title={
                u.mustChangePassword
                  ? "Has a temporary password"
                  : "Can sign in with a password"
              }
              className="text-muted"
            >
              <KeyRound className="size-3.5" />
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted">{u.email}</p>
      </div>
      <span
        className="hidden w-32 text-xs text-muted md:block"
        title={u.lastActiveAt ? fullDate(u.lastActiveAt) : undefined}
      >
        {u.lastActiveAt
          ? `Active ${timeAgo(u.lastActiveAt)}`
          : u.hasSignedIn
            ? "Signed out"
            : `Added ${timeAgo(u.joinedAt)}`}
      </span>
      <span
        className="neon-pill h-6 w-28 px-2.5 text-xs"
        style={{ "--c": statusColor } as React.CSSProperties}
      >
        {status}
      </span>
      <RoleMenu member={u} />
      <RowActions member={u} isMe={isMe} />
    </li>
  );
}

function RoleMenu({ member: u }: { member: TeamMember }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          disabled={!u.active}
          className="inline-flex h-8 w-28 items-center justify-between gap-1 rounded-md border border-grid px-2.5 text-sm capitalize transition hover:bg-hover disabled:opacity-50"
          aria-label={`Role: ${u.role}`}
        >
          {u.role === "admin" && <Shield className="size-3.5 text-primary" />}
          <span className="flex-1 text-left">{u.role}</span>
          <ChevronDown className="size-3.5 text-muted" />
        </button>
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>Role</MenuLabel>
        {(["member", "admin"] as const).map((r) => (
          <MenuItem
            key={r}
            icon={r === u.role ? <Check /> : <span />}
            onSelect={() =>
              r !== u.role &&
              act(
                () => setRole({ id: u.id, role: r }),
                `${u.name ?? u.email} is now ${r === "admin" ? "an admin" : "a member"}.`,
              )
            }
          >
            <span className="flex-1 capitalize">{r}</span>
            <span className="text-xs text-muted">
              {r === "admin" ? "Can manage people" : "Boards and tasks"}
            </span>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function RowActions({
  member: u,
  isMe,
}: {
  member: TeamMember;
  isMe: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const name = u.name ?? u.email;

  if (confirming) {
    return (
      <span className="anim-page flex w-full items-center justify-end gap-2 sm:w-auto">
        <span className="text-xs text-danger">Remove {name}?</span>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() =>
            act(
              () => deactivateUser({ id: u.id }),
              `${name} was removed and signed out.`,
              () => setConfirming(false),
            )
          }
        >
          Remove
        </Button>
      </span>
    );
  }

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button
            aria-label={`Options for ${name}`}
            className="rounded-md p-1.5 text-muted transition hover:bg-hover hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </MenuTrigger>
        <MenuContent align="end">
          {u.active && (
            <MenuItem icon={<KeyRound />} onSelect={() => setResetting(true)}>
              {u.hasPassword ? "Reset password" : "Set a password"}
            </MenuItem>
          )}
          {u.active ? (
            <MenuItem
              danger
              icon={<UserMinus />}
              disabled={isMe}
              onSelect={() => setConfirming(true)}
            >
              {isMe ? "You can't remove yourself" : "Remove from team"}
            </MenuItem>
          ) : (
            <MenuItem
              icon={<UserCheck />}
              onSelect={() =>
                act(
                  () => reactivateUser({ id: u.id }),
                  `${name} can sign in again.`,
                )
              }
            >
              Restore access
            </MenuItem>
          )}
          {!isMe && (
            <MenuItem danger icon={<Trash2 />} onSelect={() => setDeleting(true)}>
              Delete permanently
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuLabel>Joined {fullDate(u.joinedAt)}</MenuLabel>
        </MenuContent>
      </Menu>
      <ResetPasswordDialog
        member={u}
        open={resetting}
        onOpenChange={setResetting}
      />
      <Dialog open={deleting} onOpenChange={setDeleting}>
        {deleting && (
          <DialogContent
            title="Are you sure?"
            description={
              <>
                <strong className="text-foreground">{name}</strong> will be deleted permanently and can&apos;t sign in
                again unless re-added. Tasks, comments and history they created stay, shown as &quot;Deleted user&quot;.
              </>
            }
          >
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  act(
                    () => deleteUserPermanently({ id: u.id }),
                    `${name} was deleted permanently.`,
                    () => setDeleting(false),
                  )
                }
              >
                <Trash2 className="size-4" /> Delete permanently
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
