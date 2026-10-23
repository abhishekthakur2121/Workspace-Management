"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PasswordMode = "none" | "generate" | "typed";
export const MIN_PASSWORD_LENGTH = 8;

// "Google only / Generate / Type one" plus the field for a typed password.
export function PasswordChoiceField({
  mode,
  onMode,
  typed,
  onTyped,
  allowNone = true,
}: {
  mode: PasswordMode;
  onMode: (m: PasswordMode) => void;
  typed: string;
  onTyped: (v: string) => void;
  allowNone?: boolean;
}) {
  const [show, setShow] = useState(false);
  const options: { id: PasswordMode; label: string }[] = [
    ...(allowNone ? [{ id: "none" as const, label: "Google only" }] : []),
    { id: "generate", label: "Generate password" },
    { id: "typed", label: "Type a password" },
  ];
  return (
    <div className="text-sm font-medium">
      Sign-in
      <div role="radiogroup" aria-label="Sign-in" className="mt-1.5 flex h-9 w-fit rounded-md border border-border p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={mode === o.id}
            onClick={() => onMode(o.id)}
            className={cn(
              "rounded px-3 text-sm font-normal whitespace-nowrap transition-colors",
              mode === o.id ? "bg-primary text-white shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {mode === "typed" && (
        <div className="mt-2 flex h-9 max-w-xs items-center rounded-md border border-border bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <input
            type={show ? "text" : "password"}
            value={typed}
            onChange={(e) => onTyped(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            aria-label="Temporary password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            className="h-full flex-1 bg-transparent px-3 text-sm font-normal outline-none"
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="px-2.5 text-muted hover:text-foreground">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      )}
      {mode !== "none" && (
        <p className="mt-1.5 text-xs font-normal text-muted">They&apos;ll be asked to choose their own password the first time they sign in.</p>
      )}
    </div>
  );
}

// Shows a temporary password once, with a copy button. It is never shown again.
export function PasswordRevealDialog({ reveal, onClose }: { reveal: { email: string; password: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog
      open={!!reveal}
      onOpenChange={(o) => {
        if (!o) {
          setCopied(false);
          onClose();
        }
      }}
    >
      {reveal && (
        <DialogContent title="Temporary password" description={<>Share this with {reveal.email} privately. It won&apos;t be shown again.</>}>
          <div className="flex items-center gap-2 rounded-lg border border-grid bg-background p-3">
            <KeyRound className="size-4 shrink-0 text-primary" />
            <code className="flex-1 font-mono text-base tracking-wide break-all select-all">{reveal.password}</code>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(reveal.password);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? <Check className="size-4 text-[#00c875]" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            They sign in with their email and this password, then set their own. Passwords are stored only as secure hashes.
          </p>
          <div className="mt-5 flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
