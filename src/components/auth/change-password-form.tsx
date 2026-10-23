"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { changePassword } from "@/server/actions/password-auth";

const field =
  "mt-1.5 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export function ChangePasswordForm({ needsCurrent, minLength }: { needsCurrent: boolean; minLength: number }) {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-3">
      {needsCurrent && (
        <label className="block text-sm font-medium">
          Current password
          <input name="current" type="password" required autoComplete="current-password" className={field} />
        </label>
      )}
      <label className="block text-sm font-medium">
        New password
        <input name="next" type="password" required minLength={minLength} autoComplete="new-password" className={field} />
        <span className="mt-1 block text-xs font-normal text-muted">At least {minLength} characters.</span>
      </label>
      <label className="block text-sm font-medium">
        Confirm new password
        <input name="confirm" type="password" required minLength={minLength} autoComplete="new-password" className={field} />
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
