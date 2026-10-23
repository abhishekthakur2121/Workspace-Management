import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { getSignedInUser } from "@/server/auth-guard";
import { db } from "@/server/db";
import { MIN_PASSWORD_LENGTH } from "@/server/passwords";
import { signOutAction } from "@/server/actions/auth";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata: Metadata = { title: "Password" };

// Outside the (app) layout on purpose: people with a temporary password are
// sent here by requireUser() and can't reach anything else until they're done.
export default function PasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="anim-dialog w-full max-w-sm rounded-2xl border border-grid bg-surface p-8 shadow-xl shadow-black/5">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <KeyRound className="size-5" />
        </span>
        <Suspense fallback={<div className="skeleton mt-4 h-40 rounded-lg" />}>
          <PasswordBody />
        </Suspense>
      </div>
    </main>
  );
}

async function PasswordBody() {
  const me = await getSignedInUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { passwordHash: true, mustChangePassword: true } });
  const forced = user.mustChangePassword;

  return (
    <>
      <h1 className="mt-4 text-2xl font-semibold">
        {forced ? "Choose your password" : user.passwordHash ? "Change password" : "Set a password"}
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        {forced
          ? "You signed in with a temporary password. Choose your own to continue."
          : user.passwordHash
            ? "You'll stay signed in here; other devices will be signed out."
            : "Add a password so you can also sign in with your email."}
      </p>
      <ChangePasswordForm needsCurrent={!!user.passwordHash && !forced} minLength={MIN_PASSWORD_LENGTH} />
      <div className="mt-5 flex items-center justify-between text-sm">
        {forced ? <span /> : <Link href="/" className="text-muted hover:text-foreground">Back to the app</Link>}
        <form action={signOutAction}>
          <button className="text-muted hover:text-foreground">Sign out</button>
        </form>
      </div>
    </>
  );
}
