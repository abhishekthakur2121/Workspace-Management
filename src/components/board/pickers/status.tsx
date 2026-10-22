"use client";

import { useState } from "react";
import { Check, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createStatus, deleteStatus, updateStatus } from "@/server/actions/board-structure";
import { PALETTE, cn } from "@/lib/utils";
import type { Status } from "../model";

// Pick a status label; "Edit labels" renames, recolours, adds or removes them.
export function StatusPicker({
  boardId,
  statuses,
  value,
  onChange,
  children,
}: {
  boardId: string;
  statuses: Status[];
  value: string | null;
  onChange: (statusId: string | null) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setEditing(false);
      }}
    >
      {children}
      <PopoverContent className="w-56 p-2">
        {editing ? (
          <StatusEditor boardId={boardId} statuses={statuses} onDone={() => setEditing(false)} />
        ) : (
          <>
            <div className="space-y-1.5">
              {statuses.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "neon-pill neon-interactive h-8 w-full text-[13px] transition-transform duration-150 hover:-translate-y-px active:scale-[0.98]",
                    value === s.id && "ring-2 ring-offset-2 ring-offset-surface",
                  )}
                  style={{ "--c": s.color, "--tw-ring-color": s.color } as React.CSSProperties}
                >
                  {s.name}
                </button>
              ))}
              {value && (
                <button
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="flex h-8 w-full items-center justify-center rounded-full border-[1.5px] border-dashed border-border text-sm text-muted transition hover:bg-hover"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 border-t border-border pt-2 text-sm text-muted hover:text-foreground"
            >
              <Pencil className="size-3.5" /> Edit labels
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function StatusEditor({ boardId, statuses, onDone }: { boardId: string; statuses: Status[]; onDone: () => void }) {
  const [newName, setNewName] = useState("");
  return (
    <div>
      <div className="space-y-1.5">
        {statuses.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <ColorSwatch color={s.color} onChange={(color) => updateStatus({ id: s.id, color })} />
            <input
              defaultValue={s.name}
              aria-label="Label name"
              maxLength={60}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== s.name) updateStatus({ id: s.id, name });
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="h-7 min-w-0 flex-1 rounded border border-border px-2 text-sm outline-none focus:border-primary"
            />
            <button
              title={s.isDone ? "Counts as done" : "Mark as a done label"}
              aria-pressed={s.isDone}
              onClick={() => updateStatus({ id: s.id, isDone: !s.isDone })}
              className={cn("rounded p-1 hover:bg-hover", s.isDone ? "text-[#00c875]" : "text-border")}
            >
              <CheckCircle2 className="size-4" />
            </button>
            <button
              title="Delete label"
              onClick={() => {
                if (confirm(`Delete the "${s.name}" label? Tasks using it will have no status.`)) deleteStatus({ id: s.id });
              }}
              className="rounded p-1 text-muted hover:bg-hover hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <form
        className="mt-2 flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          createStatus({ boardId, name, color: PALETTE[(statuses.length + 5) % PALETTE.length] });
          setNewName("");
        }}
      >
        <Plus className="size-4 text-muted" />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New label"
          maxLength={60}
          className="h-7 min-w-0 flex-1 rounded border border-dashed border-border px-2 text-sm outline-none focus:border-primary"
        />
      </form>
      <button onClick={onDone} className="mt-2 w-full rounded bg-primary py-1.5 text-sm font-medium text-white hover:bg-primary-hover">
        Apply
      </button>
    </div>
  );
}

function ColorSwatch({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTriggerButton aria-label="Change color" className="size-6 shrink-0 rounded" style={{ backgroundColor: color }} />
      <PopoverContent className="grid w-auto grid-cols-5 gap-1.5 p-2" side="right">
        {PALETTE.map((c) => (
          <button
            key={c}
            aria-label={c}
            onClick={() => {
              onChange(c);
              setOpen(false);
            }}
            className="grid size-6 place-items-center rounded text-white"
            style={{ backgroundColor: c }}
          >
            {c === color && <Check className="size-3.5" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function PopoverTriggerButton(props: React.ComponentProps<"button">) {
  return (
    <PopoverTrigger asChild>
      <button {...props} />
    </PopoverTrigger>
  );
}
