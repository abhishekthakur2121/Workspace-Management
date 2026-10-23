"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signInWithPassword } from "@/server/actions/password-auth";

const field =
  "mt-1.5 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

// Email + password sign-in for accounts an admin created.
export function PasswordSignIn({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState(signInWithPassword, undefined);
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" required autoComplete="username" className={field} />
      </label>
      <label className="block text-sm font-medium">
        Password
        <span className="relative block">
          <input name="password" type={show ? "text" : "password"} required autoComplete="current-password" className={`${field} pr-10`} />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-2 mt-0.75 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
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
        {pending && <Loader2 className="size-4 animate-spin" />} Sign in
      </button>
      <p className="text-center text-xs text-muted">Forgot your password? Ask an admin to reset it.</p>
    </form>
  );
}
