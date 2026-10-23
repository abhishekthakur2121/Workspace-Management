"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { changePassword } from "@/server/actions/password-auth";
import { PasswordInput, generateStrongPassword } from "./password-input";

export function ChangePasswordForm({ needsCurrent, minLength }: { needsCurrent: boolean; minLength: number }) {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  function generate() {
    const password = generateStrongPassword();
    setNext(password);
    setConfirm(password);
    setVisible(true); // show it so it can be checked and copied
    setCopied(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(next);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form action={action} className="space-y-3">
      {needsCurrent && (
        <label className="block text-sm font-medium">
          Current password
          <PasswordInput name="current" required autoComplete="current-password" />
        </label>
      )}
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="new-password" className="text-sm font-medium">
            New password
          </label>
          <span className="flex items-center gap-3 text-xs">
            {next && (
              <button type="button" onClick={copy} className="inline-flex items-center gap-1 text-muted hover:text-foreground">
                {copied ? <Check className="size-3.5 text-[#00c875]" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
            <button type="button" onClick={generate} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              <Sparkles className="size-3.5" /> Generate
            </button>
          </span>
        </div>
        <PasswordInput
          id="new-password"
          name="next"
          required
          minLength={minLength}
          autoComplete="new-password"
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setCopied(false);
          }}
          visible={visible}
          onVisibleChange={setVisible}
        />
        <span className="mt-1 block text-xs text-muted">At least {minLength} characters.</span>
      </div>
      <label className="block text-sm font-medium">
        Confirm new password
        <PasswordInput
          name="confirm"
          required
          minLength={minLength}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          visible={visible}
          onVisibleChange={setVisible}
        />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />} Save password
      </button>
    </form>
  );
}
