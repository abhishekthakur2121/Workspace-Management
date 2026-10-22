"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const inputClass =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

// Create / rename prompt. `onSubmit` may throw; the message is shown inline.
export function NameDialog({
  open,
  onOpenChange,
  title,
  label,
  initialValue = "",
  placeholder,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  submitLabel: string;
  onSubmit: (value: string) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={title}>
          <NameForm
            label={label}
            initialValue={initialValue}
            placeholder={placeholder}
            submitLabel={submitLabel}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (value) => {
              await onSubmit(value);
              onOpenChange(false);
            }}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function NameForm({
  label,
  initialValue,
  placeholder,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  label: string;
  initialValue: string;
  placeholder?: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return setError("Please enter a name.");
        startTransition(async () => {
          try {
            await onSubmit(trimmed);
          } catch {
            setError("Something went wrong. Please try again.");
          }
        });
      }}
    >
      <label className="text-sm font-medium">
        {label}
        <input
          autoFocus
          value={value}
          placeholder={placeholder}
          maxLength={80}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
          className={`${inputClass} mt-1.5 font-normal`}
        />
      </label>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// Deleting a workspace or board asks the person to type its name.
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  kind,
  name,
  extra,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "workspace" | "board";
  name: string;
  extra?: string;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = typed.trim() === name.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
    >
      {open && (
        <DialogContent
          title={`Delete ${kind}?`}
          description={
            <>
              <strong className="text-foreground">{name}</strong> {extra ?? `and everything in it will be deleted.`} You
              can undo this for a few seconds afterwards.
            </>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!matches) return;
              startTransition(async () => {
                await onConfirm();
                setTyped("");
                onOpenChange(false);
              });
            }}
          >
            <label className="text-sm font-medium">
              Type <span className="font-semibold">{name}</span> to confirm
              <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} className={`${inputClass} mt-1.5 font-normal`} />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={!matches || pending}>
                Delete {kind}
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
